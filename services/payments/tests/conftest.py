import json

import pytest
from fakeredis import FakeAsyncRedis
from httpx import ASGITransport, AsyncClient

from app.config import Settings
from app.handlers import build_handlers
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
async def consumer(app):
    redis = FakeAsyncRedis(decode_responses=True)
    c = StreamConsumer(
        redis, app.state.session_factory, STREAM, "payments", "test-1", build_handlers(5000)
    )
    await c.ensure_group()
    yield c
    await redis.aclose()


@pytest.fixture
def deliver(consumer):
    async def _deliver(event_type: str, order_id: str, data: dict):
        event = build_event(event_type, "test", order_id, data)
        await consumer.redis.xadd(STREAM, {"event": json.dumps(event)})
        await consumer.poll(block_ms=10)
        return event

    return _deliver


@pytest.fixture
def order_created(deliver):
    async def _created(order_id: str, total: float = 120.0, fail: bool = False):
        return await deliver(
            "order.created",
            order_id,
            {
                "orderId": order_id,
                "customerEmail": "ada@example.com",
                "items": [{"sku": "KB-001", "quantity": 1, "unitPrice": total}],
                "total": total,
                "currency": "USD",
                "simulatePaymentFailure": fail,
            },
        )

    return _created
