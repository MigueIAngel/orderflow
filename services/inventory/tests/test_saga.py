import json

from sqlalchemy import select

from app.messaging.models import OutboxMessage
from app.messaging.outbox import publish_pending
from app.models import Product, Reservation
from tests.conftest import STREAM


async def stock_of(app, sku):
    async with app.state.session_factory() as session:
        return (await session.get(Product, sku)).stock


async def outbox_types(app):
    async with app.state.session_factory() as session:
        return [m.event_type for m in await session.scalars(select(OutboxMessage))]


def order(order_id, *items):
    return {
        "orderId": order_id,
        "items": [{"sku": s, "quantity": q, "unitPrice": 1} for s, q in items],
    }


async def test_reserves_stock_for_every_line(app, deliver):
    await deliver("order.created", "o-1", order("o-1", ("KB-001", 2), ("MS-002", 1)))

    assert await stock_of(app, "KB-001") == 23
    assert await stock_of(app, "MS-002") == 39
    assert await outbox_types(app) == ["stock.reserved"]


async def test_rejects_the_whole_order_when_one_line_is_short(app, deliver):
    await deliver("order.created", "o-2", order("o-2", ("KB-001", 1), ("WC-005", 99)))

    assert await stock_of(app, "KB-001") == 25, "nothing is reserved on rejection"
    async with app.state.session_factory() as session:
        message = await session.scalar(select(OutboxMessage))
    event = json.loads(message.payload)
    assert event["type"] == "stock.rejected"
    assert event["data"] == {"orderId": "o-2", "reason": "out_of_stock", "sku": "WC-005"}


async def test_rejects_unknown_skus(app, deliver):
    await deliver("order.created", "o-3", order("o-3", ("NOPE", 1)))
    assert await outbox_types(app) == ["stock.rejected"]


async def test_payment_failure_releases_the_reservation(app, deliver):
    await deliver("order.created", "o-4", order("o-4", ("MN-003", 3)))
    await deliver("payment.failed", "o-4", {"orderId": "o-4", "reason": "declined"})

    assert await stock_of(app, "MN-003") == 8
    assert await outbox_types(app) == ["stock.reserved", "stock.released"]
    async with app.state.session_factory() as session:
        statuses = {r.status for r in await session.scalars(select(Reservation))}
    assert statuses == {"RELEASED"}


async def test_payment_success_commits_the_reservation(app, deliver):
    await deliver("order.created", "o-5", order("o-5", ("HB-006", 1)))
    await deliver("payment.succeeded", "o-5", {"orderId": "o-5", "amount": 45.5})

    assert await stock_of(app, "HB-006") == 29
    async with app.state.session_factory() as session:
        reservation = await session.scalar(select(Reservation))
    assert reservation.status == "COMMITTED"


async def test_duplicate_events_are_ignored(app, deliver):
    _, event = await deliver("order.created", "o-6", order("o-6", ("KB-001", 5)))
    await deliver("order.created", "o-6", {}, event=event)

    assert await stock_of(app, "KB-001") == 20
    assert await outbox_types(app) == ["stock.reserved"]


async def test_events_are_acknowledged(consumer, deliver):
    await deliver("order.created", "o-7", order("o-7", ("KB-001", 1)))
    pending = await consumer.redis.xpending(STREAM, "inventory")
    assert pending["pending"] == 0


async def test_malformed_entries_go_to_the_dead_letter_stream(consumer):
    await consumer.redis.xadd(STREAM, {"event": "not json"})
    await consumer.poll(block_ms=10)
    assert await consumer.redis.xlen(f"{STREAM}:dlq") == 1


async def test_failing_handler_is_retried_then_dead_lettered(consumer, deliver):
    async def boom(session, event):
        raise RuntimeError("database on fire")

    consumer.handlers = {"order.created": boom}
    consumer.max_attempts = 2
    await deliver("order.created", "o-8", order("o-8", ("KB-001", 1)))
    assert (await consumer.redis.xpending(STREAM, "inventory"))["pending"] == 1

    await consumer.poll(pending=True)
    assert (await consumer.redis.xpending(STREAM, "inventory"))["pending"] == 0
    assert await consumer.redis.xlen(f"{STREAM}:dlq") == 1


async def test_outbox_relay_publishes_in_order(app, redis, deliver):
    await deliver("order.created", "o-9", order("o-9", ("MN-003", 1)))
    await deliver("payment.failed", "o-9", {"orderId": "o-9"})

    assert await publish_pending(app.state.session_factory, redis, "out") == 2
    assert await publish_pending(app.state.session_factory, redis, "out") == 0
    entries = await redis.xrange("out")
    assert [json.loads(f["event"])["type"] for _, f in entries] == [
        "stock.reserved",
        "stock.released",
    ]
