import asyncio
import json
import logging
from typing import Any

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.messaging.events import Event, build_event
from app.messaging.models import OutboxMessage, utcnow

log = logging.getLogger(__name__)

STREAM_MAX_LENGTH = 10_000


def add_event(
    session: AsyncSession, source: str, event_type: str, correlation_id: str, data: dict[str, Any]
) -> Event:
    """Stage an event in the outbox. It is published only if the surrounding transaction commits."""
    event = build_event(event_type, source, correlation_id, data)
    session.add(
        OutboxMessage(event_id=event["id"], event_type=event_type, payload=json.dumps(event))
    )
    return event


async def publish_pending(
    session_factory: async_sessionmaker, redis: Redis, stream: str, batch_size: int = 100
) -> int:
    """Publish unsent outbox rows in insertion order. Returns how many were published."""
    async with session_factory() as session, session.begin():
        rows = (
            await session.scalars(
                select(OutboxMessage)
                .where(OutboxMessage.published_at.is_(None))
                .order_by(OutboxMessage.id)
                .limit(batch_size)
                .with_for_update(skip_locked=True)
            )
        ).all()
        for row in rows:
            await redis.xadd(
                stream, {"event": row.payload}, maxlen=STREAM_MAX_LENGTH, approximate=True
            )
            row.published_at = utcnow()
        return len(rows)


async def run_relay(
    session_factory: async_sessionmaker, redis: Redis, stream: str, interval: float = 0.25
) -> None:
    """Background loop that drains the outbox forever."""
    while True:
        try:
            published = await publish_pending(session_factory, redis, stream)
            if published:
                log.info("outbox relay published %d event(s)", published)
                continue
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("outbox relay failed, retrying")
        await asyncio.sleep(interval)
