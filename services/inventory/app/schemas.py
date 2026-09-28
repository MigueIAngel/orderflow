from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sku: str
    name_en: str
    name_es: str
    category: str
    emoji: str
    price: float
    stock: int


class RestockIn(BaseModel):
    quantity: int = Field(gt=0, le=1000)


class ReservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_id: str
    sku: str
    quantity: int
    status: str
    created_at: datetime
    updated_at: datetime


class HealthOut(BaseModel):
    status: str
    service: str
    checks: dict[str, str]
