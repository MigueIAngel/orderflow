# Single-container build of the whole backend, for free hosting (e.g. Render free plan).
#
# Locally and in CI every service runs in its own container with its own PostgreSQL
# database (see docker-compose.yml). Free tiers only give one small container and one
# database, so this image runs the same five services as separate processes, with an
# embedded Redis and one SQLite file per service. Only the gateway port is exposed.

# ---- Node services ----
FROM node:22-slim AS node-build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY services/orders ./orders
COPY services/notifications ./notifications
COPY services/gateway ./gateway
RUN for s in orders notifications gateway; do \
      (cd $s && npm ci && npm run build && npm prune --omit=dev) || exit 1; \
    done

# ---- Runtime: Python 3.13 + Node 22 + Redis ----
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends redis-server \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node-build /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
# inventory and payments share the same requirements.txt
COPY services/inventory/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/inventory/app ./inventory/app
COPY services/payments/app ./payments/app
COPY --from=node-build /build/orders/dist ./orders/dist
COPY --from=node-build /build/orders/node_modules ./orders/node_modules
COPY --from=node-build /build/orders/package.json ./orders/
COPY --from=node-build /build/notifications/dist ./notifications/dist
COPY --from=node-build /build/notifications/node_modules ./notifications/node_modules
COPY --from=node-build /build/notifications/package.json ./notifications/
COPY --from=node-build /build/gateway/dist ./gateway/dist
COPY --from=node-build /build/gateway/node_modules ./gateway/node_modules
COPY --from=node-build /build/gateway/package.json ./gateway/
COPY deploy/demo/start.sh ./start.sh

RUN useradd --create-home app && mkdir -p /data && chown app /data
USER app
ENV PORT=10000
EXPOSE 10000
CMD ["./start.sh"]
