# Inventory service

FastAPI service that owns the product catalogue and stock. In the saga it **reserves** stock
when an order is created, **commits** the reservation when the payment succeeds and
**releases** it (compensation) when the payment fails.

| | |
| --- | --- |
| Stack | Python 3.13, FastAPI, SQLAlchemy 2 (async), Redis Streams |
| Database | PostgreSQL (`asyncpg`) or SQLite (`aiosqlite`) |
| Consumes | `order.created`, `payment.succeeded`, `payment.failed` |
| Produces | `stock.reserved`, `stock.rejected`, `stock.released` |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/products?skus=A,B` | Catalogue, optionally filtered by SKU |
| GET | `/products/{sku}` | One product |
| POST | `/products/{sku}/restock` | Add units (`{"quantity": 10}`) |
| GET | `/reservations?orderId=` | Latest reservations |
| GET | `/health` | Database and Redis checks |

Interactive docs at `/docs`.

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # or leave it out to use SQLite
uvicorn app.main:app --reload --port 8001
pytest                          # 16 tests, no Redis or Postgres needed (fakeredis + SQLite)
```

## How messaging works here

- `app/messaging/outbox.py`: events are written to `outbox_messages` in the same transaction
  as the stock change; a background relay publishes them to the stream.
- `app/messaging/consumer.py`: reads the stream through the `inventory` consumer group,
  records each event id in `processed_events` (idempotency), retries failures and moves
  poison messages to `orderflow:events:dlq`.
