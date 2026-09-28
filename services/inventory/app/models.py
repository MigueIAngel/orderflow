from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.messaging.models import utcnow


class Product(Base):
    __tablename__ = "products"

    sku: Mapped[str] = mapped_column(String(40), primary_key=True)
    name_en: Mapped[str] = mapped_column(String(120))
    name_es: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(40))
    emoji: Mapped[str] = mapped_column(String(8))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    stock: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class ReservationStatus(StrEnum):
    RESERVED = "RESERVED"
    COMMITTED = "COMMITTED"
    RELEASED = "RELEASED"


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(String(36), index=True)
    sku: Mapped[str] = mapped_column(ForeignKey("products.sku"))
    quantity: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), default=ReservationStatus.RESERVED)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
