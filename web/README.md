# OrderFlow web

React client for the OrderFlow demo, in English and Spanish. It is built to *show* the
saga: every order page draws the timeline of events as they arrive.

| | |
| --- | --- |
| Stack | React 19, Vite 8, TypeScript, Tailwind CSS 4, TanStack Query, Zustand, React Router 7, i18next |
| Talks to | API gateway only (`/api/*`) |
| Realtime | One `EventSource` on `/api/notifications/stream` for the whole app |

## Pages

| Route | What it shows |
| --- | --- |
| `/` | Catalogue with live stock, a cart and a switch that makes the payment fail |
| `/orders` | Latest orders, updated live |
| `/orders/:id` | Saga timeline (placed → stock → payment → outcome), compensation, payment and reservations, from the gateway's composed `/summary` endpoint |
| `/events` | Raw live event stream with the producing service |
| `/architecture` | Diagram, live health, latency and circuit-breaker state of every service |

When the free-tier backend is asleep, a banner explains the wait. Queries keep retrying
until the services come back.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to the gateway on :3000
npm test           # 12 tests: saga steps, event texts (EN/ES), cart store, components
```

For a production build that talks to a remote gateway: `VITE_API_URL=https://… npm run build`.
In Docker Compose, nginx serves the build and proxies `/api` to the gateway (same origin, SSE
buffering disabled).
