from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models import Product

CATALOGUE = [
    ("KB-001", "Mechanical keyboard", "Teclado mecánico", "peripherals", "⌨️", "89.00", 25),
    ("MS-002", "Wireless mouse", "Mouse inalámbrico", "peripherals", "🖱️", "39.90", 40),
    ("MN-003", '27" 4K monitor', 'Monitor 4K de 27"', "displays", "🖥️", "329.00", 8),
    (
        "HP-004",
        "Noise-cancelling headphones",
        "Audífonos con cancelación de ruido",
        "audio",
        "🎧",
        "149.00",
        12,
    ),
    ("WC-005", "1080p webcam", "Cámara web 1080p", "video", "📷", "59.00", 3),
    ("HB-006", "USB-C hub (7 in 1)", "Hub USB-C (7 en 1)", "accessories", "🔌", "45.50", 30),
    (
        "LS-007",
        "Aluminium laptop stand",
        "Soporte de aluminio para portátil",
        "accessories",
        "💻",
        "34.99",
        18,
    ),
    ("LP-008", "LED desk lamp", "Lámpara LED de escritorio", "accessories", "💡", "27.00", 0),
]


async def seed_catalogue(session_factory: async_sessionmaker) -> None:
    async with session_factory() as session, session.begin():
        if await session.scalar(select(func.count()).select_from(Product)):
            return
        session.add_all(
            Product(
                sku=sku,
                name_en=en,
                name_es=es,
                category=category,
                emoji=emoji,
                price=Decimal(price),
                stock=stock,
            )
            for sku, en, es, category, emoji, price, stock in CATALOGUE
        )
