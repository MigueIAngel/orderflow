from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Product, Reservation
from app.schemas import HealthOut, ProductOut, ReservationOut, RestockIn

router = APIRouter()


async def get_session(request: Request):
    async with request.app.state.session_factory() as session:
        yield session


Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("/products", response_model=list[ProductOut], tags=["products"])
async def list_products(
    session: Session,
    skus: Annotated[str | None, Query(description="Comma-separated SKUs to filter by")] = None,
):
    query = select(Product).order_by(Product.sku)
    if skus:
        query = query.where(Product.sku.in_([s.strip() for s in skus.split(",") if s.strip()]))
    return (await session.scalars(query)).all()


@router.get("/products/{sku}", response_model=ProductOut, tags=["products"])
async def get_product(sku: str, session: Session):
    product = await session.get(Product, sku)
    if product is None:
        raise HTTPException(404, f"Product {sku} not found")
    return product


@router.post("/products/{sku}/restock", response_model=ProductOut, tags=["products"])
async def restock(sku: str, body: RestockIn, session: Session):
    """Adds units to a product. Handy for replaying the saga in the demo."""
    async with session.begin():
        product = await session.get(Product, sku, with_for_update=True)
        if product is None:
            raise HTTPException(404, f"Product {sku} not found")
        product.stock += body.quantity
    return product


@router.get("/reservations", response_model=list[ReservationOut], tags=["reservations"])
async def list_reservations(
    session: Session, order_id: Annotated[str | None, Query(alias="orderId")] = None
):
    query = select(Reservation).order_by(Reservation.id.desc()).limit(100)
    if order_id:
        query = query.where(Reservation.order_id == order_id)
    return (await session.scalars(query)).all()


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
    return {"status": status, "service": "inventory", "checks": checks}
