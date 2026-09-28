#!/usr/bin/env bash
# Starts every OrderFlow service in one container. If any process exits, the container
# exits too, so the platform restarts it (no half-alive deployments).
set -e

DATA=${DATA_DIR:-/data}
export REDIS_URL=redis://127.0.0.1:6379/0

redis-server --port 6379 --bind 127.0.0.1 --save "" --appendonly no --maxmemory 48mb \
  --maxmemory-policy noeviction --daemonize no &
until redis-cli -p 6379 ping >/dev/null 2>&1; do sleep 0.2; done

(cd /app/inventory && DATABASE_URL="sqlite+aiosqlite:///$DATA/inventory.db" \
  exec uvicorn app.main:app --host 127.0.0.1 --port 8001 --no-access-log) &
(cd /app/payments && DATABASE_URL="sqlite+aiosqlite:///$DATA/payments.db" \
  exec uvicorn app.main:app --host 127.0.0.1 --port 8002 --no-access-log) &
(cd /app/orders && DATABASE_URL="sqlite:$DATA/orders.db" PORT=3001 \
  INVENTORY_URL=http://127.0.0.1:8001 exec node dist/main.js) &
(cd /app/notifications && PORT=3002 exec node dist/server.js) &
(cd /app/gateway && INVENTORY_URL=http://127.0.0.1:8001 PAYMENTS_URL=http://127.0.0.1:8002 \
  ORDERS_URL=http://127.0.0.1:3001 NOTIFICATIONS_URL=http://127.0.0.1:3002 \
  TRUST_PROXY=1 exec node dist/main.js) &

# Exit as soon as any service dies.
wait -n
exit 1
