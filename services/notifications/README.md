# Notifications service

Small Fastify service that listens to **every** saga event and turns it into a customer
notification. It pushes them live to the browser with Server-Sent Events and simulates the
customer email when an order is confirmed or cancelled.

| | |
| --- | --- |
| Stack | Node.js 22, Fastify 5, TypeScript, ioredis |
| Storage | Redis only: a capped list with the latest notifications (no database) |
| Consumes | all events on `orderflow:events` (consumer group `notifications`) |
| Produces | nothing (end of the line) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/notifications?orderId=&limit=` | Latest notifications, newest first |
| GET | `/notifications/stream` | `text/event-stream`, one `notification` event per saga event |
| GET | `/health` | Redis check and number of open SSE connections |

Swagger UI at `/docs`, OpenAPI JSON at `/openapi.json`.

```bash
curl -N http://localhost:3002/notifications/stream
# event: notification
# data: {"type":"stock.reserved","orderId":"…","channel":"feed",…}
```

## Notes

- Text is **not** rendered here: the frontend translates `type` into English or Spanish.
- Duplicates are dropped with a `SET NX` per event id, so redeliveries never show twice.
- `NotificationHub` fans out in process; to run several replicas you would publish to a
  Redis Pub/Sub channel instead (documented trade-off, one replica is enough here).

## Run locally

```bash
npm install
npm run dev
npm test        # 15 tests, including a real SSE connection
```
