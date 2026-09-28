from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class OutboxMessage(Base):
    """Events waiting to be published. Written in the same transaction as the state change."""

    __tablename__ = "outbox_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(36), unique=True)
    event_type: Mapped[str] = mapped_column(String(50))
    payload: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )


class ProcessedEvent(Base):
    """Ids of events already handled, so redelivered events are ignored (idempotent consumer)."""

    __tablename__ = "processed_events"

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(50))
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
