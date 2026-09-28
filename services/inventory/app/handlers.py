"""Saga steps owned by the inventory service."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.messaging.consumer import Handler
from app.messaging.events import Event
from app.messaging.outbox import add_event
from app.models import Product, Reservation, ReservationStatus

SOURCE = "inventory"


async def on_order_created(session: AsyncSession, event: Event) -> None:
    """Reserve every line of the order, or none of them."""
    order_id = event["data"]["orderId"]
    wanted: dict[str, int] = {}
    for item in event["data"]["items"]:
        wanted[item["sku"]] = wanted.get(item["sku"], 0) + int(item["quantity"])

    products = {
        p.sku: p
        for p in await session.scalars(
            select(Product).where(Product.sku.in_(wanted)).with_for_update()
        )
    }
    for sku, quantity in wanted.items():
        product = products.get(sku)
        if product is None or product.stock < quantity:
            reason = "unknown_sku" if product is None else "out_of_stock"
            add_event(
                session,
                SOURCE,
                "stock.rejected",
                order_id,
                {"orderId": order_id, "reason": reason, "sku": sku},
            )
            return

    for sku, quantity in wanted.items():
        products[sku].stock -= quantity
        session.add(Reservation(order_id=order_id, sku=sku, quantity=quantity))
    add_event(
        session,
        SOURCE,
        "stock.reserved",
        order_id,
        {"orderId": order_id, "items": [{"sku": s, "quantity": q} for s, q in wanted.items()]},
    )


async def _reservations(session: AsyncSession, order_id: str) -> list[Reservation]:
    return list(
        await session.scalars(
            select(Reservation).where(
                Reservation.order_id == order_id,
                Reservation.status == ReservationStatus.RESERVED,
            )
        )
    )


async def on_payment_failed(session: AsyncSession, event: Event) -> None:
    """Compensation: put the reserved units back on the shelf."""
    order_id = event["data"]["orderId"]
    reservations = await _reservations(session, order_id)
    if not reservations:
        return
    for reservation in reservations:
        product = await session.get(Product, reservation.sku, with_for_update=True)
        product.stock += reservation.quantity
        reservation.status = ReservationStatus.RELEASED
    add_event(
        session,
        SOURCE,
        "stock.released",
        order_id,
        {
            "orderId": order_id,
            "items": [{"sku": r.sku, "quantity": r.quantity} for r in reservations],
        },
    )


async def on_payment_succeeded(session: AsyncSession, event: Event) -> None:
    for reservation in await _reservations(session, event["data"]["orderId"]):
        reservation.status = ReservationStatus.COMMITTED


HANDLERS: dict[str, Handler] = {
    "order.created": on_order_created,
    "payment.failed": on_payment_failed,
    "payment.succeeded": on_payment_succeeded,
}
