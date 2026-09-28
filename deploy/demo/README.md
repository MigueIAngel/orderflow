# Single-container demo

The public demo runs on Render's free plan, which gives one 512 MB container per service
and a single database for the whole account. Five services with their own databases do
not fit there, so this image packs the backend into one container:

| Process | Port (inside) | Storage |
| --- | --- | --- |
| Redis 8 (streams) | 6379 | memory |
| inventory (uvicorn) | 8001 | SQLite `/data/inventory.db` |
| payments (uvicorn) | 8002 | SQLite `/data/payments.db` |
| orders (node) | 3001 | SQLite `/data/orders.db` |
| notifications (node) | 3002 | Redis |
| gateway (node) | `$PORT` (10000) | none, and the only public port |

The code is exactly the same as in Compose; only the environment variables change.
Services still talk only over HTTP and Redis Streams. `start.sh` exits as soon as any
process dies, so the platform restarts the whole container instead of leaving it half alive.

Trade-offs (fine for a demo, not for production): data resets on every restart, the whole
backend scales as one unit, and the services share one CPU. It uses about 300 MB of RAM.

```bash
docker build -f deploy/demo/Dockerfile -t orderflow-demo .
docker run --rm -p 10000:10000 orderflow-demo
scripts/smoke-test.sh http://localhost:10000
```
