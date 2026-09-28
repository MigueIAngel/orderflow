import asyncio
import json
import logging
from collections import defaultdict
from collections.abc import Awaitable, Callable

from redis.asyncio import Redis
from redis.exceptions import ResponseError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.messaging.events import Event, parse_event
from app.messaging.models import ProcessedEvent

log = logging.getLogger(__name__)

Handler = Callable[[AsyncSession, Event], Awaitable[None]]


class StreamConsumer:
    """Reads the shared stream through this service's consumer group.

    Each event is handled inside one database transaction together with its
    `processed_events` row, which makes redelivery harmless. Failing entries are left
    pending and retried; after `max_attempts` they are moved to a dead-letter stream.
    """

    def __init__(
        self,
        redis: Redis,
        session_factory: async_sessionmaker,
        stream: str,
        group: str,
        consumer: str,
        handlers: dict[str, Handler],
        processing_delay: float = 0.0,
        max_attempts: int = 5,
    ) -> None:
        self.redis = redis
        self.session_factory = session_factory
        self.stream = stream
        self.group = group
        self.consumer = consumer
        self.handlers = handlers
        self.processing_delay = processing_delay
        self.max_attempts = max_attempts
        self.dead_letter_stream = f"{stream}:dlq"
        self._attempts: dict[str, int] = defaultdict(int)

    async def ensure_group(self) -> None:
        try:
            # "0" so a service that starts late still sees events published before it existed.
            await self.redis.xgroup_create(self.stream, self.group, id="0", mkstream=True)
        except ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    async def poll(self, pending: bool = False, block_ms: int = 2000) -> int:
        """Read one batch. `pending=True` re-reads entries delivered but not acknowledged."""
        response = await self.redis.xreadgroup(
            self.group,
            self.consumer,
            {self.stream: "0" if pending else ">"},
            count=20,
            block=None if pending else block_ms,
        )
        handled = 0
        for _stream, entries in response or []:
            for entry_id, fields in entries:
                await self.process(entry_id, fields)
                handled += 1
        return handled

    async def process(self, entry_id: str, fields: dict[str, str]) -> None:
        try:
            event = parse_event(fields["event"])
        except (KeyError, ValueError, json.JSONDecodeError):
            log.error("malformed stream entry %s, moving to dead letters", entry_id)
            await self._dead_letter(entry_id, fields, "malformed")
            return

        handler = self.handlers.get(event["type"])
        if handler is None:
            await self.redis.xack(self.stream, self.group, entry_id)
            return

        if self.processing_delay:
            await asyncio.sleep(self.processing_delay)
        try:
            async with self.session_factory() as session, session.begin():
                if await session.get(ProcessedEvent, event["id"]) is None:
                    session.add(ProcessedEvent(event_id=event["id"], event_type=event["type"]))
                    await handler(session, event)
                    log.info("handled %s for %s", event["type"], event["correlationId"])
        except Exception:
            self._attempts[entry_id] += 1
            log.exception(
                "handler for %s failed (attempt %d)", event["type"], self._attempts[entry_id]
            )
            if self._attempts[entry_id] >= self.max_attempts:
                await self._dead_letter(entry_id, fields, "max attempts reached")
            return
        self._attempts.pop(entry_id, None)
        await self.redis.xack(self.stream, self.group, entry_id)

    async def _dead_letter(self, entry_id: str, fields: dict[str, str], reason: str) -> None:
        await self.redis.xadd(
            self.dead_letter_stream, {**fields, "reason": reason, "group": self.group}
        )
        await self.redis.xack(self.stream, self.group, entry_id)
        self._attempts.pop(entry_id, None)

    async def run(self) -> None:
        await self.ensure_group()
        await self.poll(pending=True)
        while True:
            try:
                await self.poll()
                if self._attempts:
                    await asyncio.sleep(1)
                    await self.poll(pending=True)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("consumer loop error, reconnecting")
                await asyncio.sleep(2)
