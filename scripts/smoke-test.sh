#!/usr/bin/env bash
# End-to-end check of the whole saga through the gateway.
# Usage: scripts/smoke-test.sh [gateway-url]   (default http://localhost:3000)
set -euo pipefail

API="${1:-http://localhost:3000}/api"

echo "Waiting for every service to be up…"
for _ in $(seq 1 90); do
  status=$(curl -sf "$API/health" | jq -r .status || true)
  [ "$status" = "up" ] && break
  sleep 2
done
curl -sf "$API/health" | jq -c '.services | map_values(.status)'
[ "$status" = "up" ] || { echo "services did not come up"; exit 1; }

place() {
  curl -sf -X POST "$API/orders" -H 'content-type: application/json' -d "$1" | jq -r .id
}

wait_for() { # order-id expected-status
  for _ in $(seq 1 60); do
    current=$(curl -sf "$API/orders/$1" | jq -r .status)
    case "$current" in CONFIRMED|CANCELLED) break ;; esac
    sleep 1
  done
  if [ "$current" != "$2" ]; then
    echo "FAIL order $1: expected $2, got $current"
    curl -s "$API/orders/$1/summary" | jq .
    exit 1
  fi
  echo "ok   order ${1:0:8} → $current ($(curl -sf "$API/orders/$1" | jq -r '.cancelReason // "-"'))"
}

happy=$(place '{"customerEmail":"ci@example.com","items":[{"sku":"KB-001","quantity":1},{"sku":"MS-002","quantity":2}]}')
declined=$(place '{"customerEmail":"ci@example.com","items":[{"sku":"MN-003","quantity":1}],"simulatePaymentFailure":true}')
no_stock=$(place '{"customerEmail":"ci@example.com","items":[{"sku":"LP-008","quantity":1}]}')

wait_for "$happy" CONFIRMED
wait_for "$declined" CANCELLED
wait_for "$no_stock" CANCELLED

# Compensation runs in inventory in parallel with the cancellation, so give it a moment.
released=false
for _ in $(seq 1 20); do
  if curl -sf "$API/orders/$declined/summary" \
    | jq -e '.reservations | length > 0 and all(.status == "RELEASED")' >/dev/null; then
    released=true && break
  fi
  sleep 1
done
$released || { echo "FAIL stock was not released"; exit 1; }
echo "ok   compensation released the reserved stock"

# Notifications saw the whole saga of the happy order.
for _ in $(seq 1 20); do
  types=$(curl -sf "$API/orders/$happy/summary" | jq -r '[.notifications[].type] | sort | join(",")')
  [ "$types" = "order.confirmed,order.created,payment.succeeded,stock.reserved" ] && break
  sleep 1
done
[ "$types" = "order.confirmed,order.created,payment.succeeded,stock.reserved" ] \
  || { echo "FAIL notifications: $types"; exit 1; }
echo "ok   notifications received all 4 events"
echo "Saga smoke test passed."
