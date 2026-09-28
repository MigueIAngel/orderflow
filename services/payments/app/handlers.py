"""Saga steps owned by the payments service."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.messaging.consumer import Handler
from app.messaging.events import Event
from app.messaging.outbox import add_event
from app.models import Payment, PaymentStatus

SOURCE = "payments"


class PaymentNotFoundError(Exception):
    """The intent does not exist yet; the consumer retries the event later."""


async def _payment(session: AsyncSession, order_id: str) -> Payment | None:
    return await session.scalar(
        select(Payment).where(Payment.order_id == order_id).with_for_update()
    )


def build_handlers(card_limit: float) -> dict[str, Handler]:
    async def on_order_created(session: AsyncSession, event: Event) -> None:
        """Keep a local copy of what we need to charge later (no call back to orders)."""
        data = event["data"]
        if await _payment(session, data["orderId"]) is not None:
            return
        session.add(
            Payment(
                order_id=data["orderId"],
                customer_email=data["customerEmail"],
                amount=Decimal(str(data["total"])),
                currency=data.get("currency", "USD"),
                simulate_failure=bool(data.get("simulatePaymentFailure", False)),
            )
        )

    async def on_stock_reserved(session: AsyncSession, event: Event) -> None:
        order_id = event["data"]["orderId"]
        payment = await _payment(session, order_id)
        if payment is None:
            raise PaymentNotFoundError(order_id)
        if payment.status != PaymentStatus.PENDING:
            return

        if payment.simulate_failure:
            payment.failure_reason = "card_declined"
        elif payment.amount > Decimal(str(card_limit)):
            payment.failure_reason = "amount_exceeds_limit"

        payload = {"orderId": order_id, "paymentId": payment.id, "amount": float(payment.amount)}
        if payment.failure_reason:
            payment.status = PaymentStatus.FAILED
            add_event(
                session,
                SOURCE,
                "payment.failed",
                order_id,
                {**payload, "reason": payment.failure_reason},
            )
        else:
            payment.status = PaymentStatus.SUCCEEDED
            add_event(session, SOURCE, "payment.succeeded", order_id, payload)

    async def on_stock_rejected(session: AsyncSession, event: Event) -> None:
        """Nothing to charge: the order never got its stock."""
        payment = await _payment(session, event["data"]["orderId"])
        if payment is not None and payment.status == PaymentStatus.PENDING:
            payment.status = PaymentStatus.VOIDED
            payment.failure_reason = "stock_rejected"

    return {
        "order.created": on_order_created,
        "stock.reserved": on_stock_reserved,
        "stock.rejected": on_stock_rejected,
    }
