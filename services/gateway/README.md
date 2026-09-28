# API gateway

Single public entry point. The browser only ever talks to the gateway; the services are
private.

| | |
| --- | --- |
| Stack | Node.js 22, NestJS 12 (Express 5), http-proxy-middleware |
| State | None (breakers and rate-limit windows live in memory) |

## Routing

| Public path | Service | Upstream path |
| --- | --- | --- |
| `/api/products/**`, `/api/reservations` | inventory | `/products/**`, `/reservations` |
| `/api/orders/**` | orders | `/orders/**` |
| `/api/payments/**` | payments | `/payments/**` |
| `/api/notifications/**` (incl. SSE) | notifications | `/notifications/**` |

Service locations come from `INVENTORY_URL`, `ORDERS_URL`, `PAYMENTS_URL` and
`NOTIFICATIONS_URL`.

## What the gateway adds

- **Request ids**: `x-request-id` is created (or kept), forwarded downstream and returned,
  with one access log line per request.
- **Circuit breaker per service**: after `BREAKER_THRESHOLD` consecutive network errors or
  5xx responses the circuit opens and requests fail fast with `503` + `Retry-After`; after
  `BREAKER_COOLDOWN_MS` one trial request is let through (half-open).
- **Timeouts**: 10 s for normal routes, none for the SSE stream.
- **Rate limiting**: `POST /api/orders` is limited per client IP (`RATE_LIMIT_ORDERS_PER_MIN`).
- **API composition**: `GET /api/orders/{id}/summary` calls orders, payments, inventory and
  notifications in parallel and returns one document; optional parts degrade to empty
  values and are listed in `unavailable`.
- **Aggregated health**: `GET /api/health` with status, latency and circuit state of every
  service.
- **Unified docs**: `/docs` is a Swagger UI with a selector for the gateway and each
  service. Service documents are fetched live and rewritten to use `/api`, so "Try it
  out" goes through the gateway.

Bodies are never parsed by the gateway (`bodyParser: false`); they stream straight to the
service.

## Run locally

```bash
npm install
cp .env.example .env
npm run start:dev
npm test        # 19 tests: breaker, rate limiter and e2e against fake upstream servers
```
