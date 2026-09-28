# Payments service

FastAPI service that simulates a card processor. It keeps its **own copy** of the data it
needs (amount, customer, demo flag) from `order.created`, so it never has to call the orders
service back, and charges the order once the inventory service has reserved the stock.

| | |
| --- | --- |
| Stack | Python 3.13, FastAPI, SQLAlchemy 2 (async), Redis Streams |
| Database | PostgreSQL (`asyncpg`) or SQLite (`aiosqlite`) |
| Consumes | `order.created`, `stock.reserved`, `stock.rejected` |
| Produces | `payment.succeeded`, `payment.failed` |

## Charging rules (simulated)

| Condition | Result |
| --- | --- |
| Order was placed with `simulatePaymentFailure: true` | `payment.failed` · `card_declined` |
| Amount above `CARD_LIMIT` (default 5000 USD) | `payment.failed` · `amount_exceeds_limit` |
| Stock was rejected | Intent is `VOIDED`, nothing is charged |
| Otherwise | `payment.succeeded` |

A payment is charged at most once: only `PENDING` intents can move to `SUCCEEDED` or
`FAILED`. If `stock.reserved` arrives before the intent exists, the handler raises and the
consumer retries the entry.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/payments?status=` | Latest payments |
| GET | `/payments/{orderId}` | Payment of one order |
| GET | `/health` | Database and Redis checks |

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8002
pytest
```

The `app/messaging` package is the same one used by the inventory service (outbox relay,
idempotent consumer group, dead letters). It is copied on purpose: services do not share
code at runtime.
