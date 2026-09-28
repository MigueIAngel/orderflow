from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Payment
from app.schemas import HealthOut, PaymentOut

router = APIRouter()


async def get_session(request: Request):
    async with request.app.state.session_factory() as session:
        yield session


Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("/payments", response_model=list[PaymentOut], tags=["payments"])
async def list_payments(
    session: Session,
    status: Annotated[str | None, Query(description="PENDING, SUCCEEDED, FAILED or VOIDED")] = None,
):
    query = select(Payment).order_by(Payment.created_at.desc()).limit(100)
    if status:
        query = query.where(Payment.status == status.upper())
    return (await session.scalars(query)).all()


@router.get("/payments/{order_id}", response_model=PaymentOut, tags=["payments"])
async def get_payment(order_id: str, session: Session):
    payment = await session.scalar(select(Payment).where(Payment.order_id == order_id))
    if payment is None:
        raise HTTPException(404, f"No payment for order {order_id}")
    return payment


@router.get("/health", response_model=HealthOut, tags=["health"])
async def health(request: Request, session: Session):
    checks = {}
    try:
        await session.execute(text("SELECT 1"))
        checks["database"] = "up"
    except Exception:
        checks["database"] = "down"
    redis = getattr(request.app.state, "redis", None)
    if redis is not None:
        try:
            await redis.ping()
            checks["redis"] = "up"
        except Exception:
            checks["redis"] = "down"
    status = "up" if all(v == "up" for v in checks.values()) else "degraded"
    return {"status": status, "service": "payments", "checks": checks}
