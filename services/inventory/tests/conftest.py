import json

import pytest
from fakeredis import FakeAsyncRedis
from httpx import ASGITransport, AsyncClient

from app.config import Settings
from app.handlers import HANDLERS
from app.main import create_app
from app.messaging.consumer import StreamConsumer
from app.messaging.events import build_event

STREAM = "test:events"


@pytest.fixture
async def app(tmp_path):
    settings = Settings(
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
        enable_messaging=False,
        processing_delay_ms=0,
    )
    application = create_app(settings)
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def redis():
    r = FakeAsyncRedis(decode_responses=True)
    yield r
    await r.aclose()


@pytest.fixture
async def consumer(app, redis):
    c = StreamConsumer(redis, app.state.session_factory, STREAM, "inventory", "test-1", HANDLERS)
    await c.ensure_group()
    return c


@pytest.fixture
def deliver(consumer):
    """Feed an event to the consumer as if it came from the stream."""

    async def _deliver(event_type: str, order_id: str, data: dict, event=None):
        event = event or build_event(event_type, "test", order_id, data)
        entry_id = await consumer.redis.xadd(STREAM, {"event": json.dumps(event)})
        await consumer.poll(block_ms=10)
        return entry_id, event

    return _deliver
