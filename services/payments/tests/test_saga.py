import json

from sqlalchemy import select

from app.messaging.models import OutboxMessage
from app.models import Payment
from tests.conftest import STREAM


async def payment_for(app, order_id):
    async with app.state.session_factory() as session:
        return await session.scalar(select(Payment).where(Payment.order_id == order_id))


async def published(app):
    async with app.state.session_factory() as session:
        return [json.loads(m.payload) for m in await session.scalars(select(OutboxMessage))]


async def test_order_created_opens_a_pending_intent(app, order_created):
    await order_created("o-1", total=89.9)

    payment = await payment_for(app, "o-1")
    assert payment.status == "PENDING"
    assert float(payment.amount) == 89.9
    assert await published(app) == []


async def test_charges_once_stock_is_reserved(app, order_created, deliver):
    await order_created("o-2", total=120)
    await deliver("stock.reserved", "o-2", {"orderId": "o-2", "items": []})

    payment = await payment_for(app, "o-2")
    assert payment.status == "SUCCEEDED"
    [event] = await published(app)
    assert event["type"] == "payment.succeeded"
    assert event["correlationId"] == "o-2"
    assert event["data"] == {"orderId": "o-2", "paymentId": payment.id, "amount": 120.0}


async def test_simulated_decline(app, order_created, deliver):
    await order_created("o-3", fail=True)
    await deliver("stock.reserved", "o-3", {"orderId": "o-3"})

    [event] = await published(app)
    assert event["type"] == "payment.failed"
    assert event["data"]["reason"] == "card_declined"
    assert (await payment_for(app, "o-3")).status == "FAILED"


async def test_amount_over_the_card_limit_is_declined(app, order_created, deliver):
    await order_created("o-4", total=5000.01)
    await deliver("stock.reserved", "o-4", {"orderId": "o-4"})

    [event] = await published(app)
    assert event["data"]["reason"] == "amount_exceeds_limit"


async def test_rejected_stock_voids_the_intent(app, order_created, deliver):
    await order_created("o-5")
    await deliver("stock.rejected", "o-5", {"orderId": "o-5", "reason": "out_of_stock"})

    assert (await payment_for(app, "o-5")).status == "VOIDED"
    assert await published(app) == []


async def test_charge_happens_only_once(app, order_created, deliver):
    await order_created("o-6")
    await deliver("stock.reserved", "o-6", {"orderId": "o-6"})
    await deliver("stock.reserved", "o-6", {"orderId": "o-6"})  # a second, different event

    assert len(await published(app)) == 1


async def test_reservation_before_intent_is_retried(app, consumer, deliver):
    await deliver("stock.reserved", "o-7", {"orderId": "o-7"})
    assert (await consumer.redis.xpending(STREAM, "payments"))["pending"] == 1
