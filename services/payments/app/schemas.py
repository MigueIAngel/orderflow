from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    customer_email: str
    amount: float
    currency: str
    status: str
    failure_reason: str | None
    created_at: datetime
    updated_at: datetime


class HealthOut(BaseModel):
    status: str
    service: str
    checks: dict[str, str]
