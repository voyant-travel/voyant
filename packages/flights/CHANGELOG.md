# @voyantjs/flights

## 0.26.8

### Patch Changes

- @voyantjs/catalog@0.26.8
- @voyantjs/db@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/catalog@0.26.7
- @voyantjs/db@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/catalog@0.26.6
- @voyantjs/db@0.26.6

## 0.26.5

### Patch Changes

- Updated dependencies [7a92aba]
  - @voyantjs/catalog@0.26.5
  - @voyantjs/db@0.26.5

## 0.26.4

### Patch Changes

- Updated dependencies [6493f62]
  - @voyantjs/catalog@0.26.4
  - @voyantjs/db@0.26.4

## 0.26.3

### Patch Changes

- Updated dependencies [372cad5]
  - @voyantjs/catalog@0.26.3
  - @voyantjs/db@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [ffdb485]
  - @voyantjs/catalog@0.26.2
  - @voyantjs/db@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [c0507a6]
  - @voyantjs/catalog@0.26.1
  - @voyantjs/db@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/catalog@0.26.0
- @voyantjs/db@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/catalog@0.25.0
- @voyantjs/db@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/catalog@0.24.3
- @voyantjs/db@0.24.3

## 0.24.2

### Patch Changes

- Updated dependencies [bec0471]
  - @voyantjs/catalog@0.24.2
  - @voyantjs/db@0.24.2

## 0.24.1

### Patch Changes

- Updated dependencies [2d6297d]
  - @voyantjs/catalog@0.24.1
  - @voyantjs/db@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/catalog@0.24.0
- @voyantjs/db@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/catalog@0.23.0
- @voyantjs/db@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/catalog@0.22.0
- @voyantjs/db@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/catalog@0.21.1
- @voyantjs/db@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/catalog@0.21.0
  - @voyantjs/db@0.21.0

## 0.20.0

### Minor Changes

- cc3eddd: **Demo flight adapter is now a standalone HTTP service with its own DB; flight orders get a list page, payment status badges, and search/filter/sort.**

  The previous demo adapter lived inside the operator template, used an in-memory `Map` for "persistence" (orders vanished on every restart), and bled fake tables into the template's primary Postgres. None of that scales to "show me my bookings". This release extracts the demo into a proper standalone provider so the operator template no longer pretends a demo is real.

  - **New** `@voyantjs/plugin-flights-demo` is now a thin HTTP-client `FlightConnectorAdapter` (~150 lines, zero state). `createDemoFlightAdapter({ baseUrl })` returns the adapter; every method `fetch()`s the standalone service. Real GDS connectors (Sabre, Amadeus, Duffel) plug in the same way — replace the import, no template churn.
  - **New runnable** `apps/flights-demo-api` (Node + Hono + drizzle + postgres) — own database, own migrations, own `docker-compose.yml`. Mirrors the `FlightConnectorAdapter` 1:1 over REST: `POST /search`, `POST /price`, `POST /book`, `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel`, `POST /ancillaries`, `POST /seatmap`, `GET /health`. Fails fast at startup if its Postgres is unreachable. Set `FLIGHTS_DEMO_DATABASE_URL` (preferred over the shared `DATABASE_URL` so the demo can never silently inherit the operator's DB).
  - **Booking** is no longer "idempotent" via deterministic order id — `synthesizeOrder` now seeds with the offer hash + `Date.now()` + a random nonce so every `bookFlight` call mints a unique PNR, matching real GDS behaviour. Same offer + same passengers → distinct order rows.
  - **Contract: `FlightConnectorAdapter.listOrders?(ctx, query)`** is a new optional method (`flight/list-orders` capability), with `FlightOrdersListQuery` and `FlightOrdersListResponse` types. Adapters that own a persistent store (the demo, real travel-tech connectors with agency-side APIs) implement it; pass-through GDS connectors simply omit it. `FlightAdapterContext.deps` is a new optional escape hatch for adapter-specific runtime handles (DB, FX clients, etc.) — real connectors ignore it.
  - **`useFlightOrders(filters?)`** hook in `@voyantjs/flights-react` with `cursor` / `limit` / `search` / `status` / `paymentStatus` filters, plus the `FlightOrdersListResponseDto` schema and the new `FlightOrderPaymentStatus` enum.
  - **Operator template** gets `/flights/orders` route, sidebar "Orders" sub-item under Flights (en + ro i18n), payment status badge on the booking confirmation page, and the orders list now includes Booking + Payment status columns, search debounced 250ms, two filter dropdowns (booking status + payment status — operator-side filter against the bulk-fetched session map, no N+1), and toggle-direction sort headers on Order/Total.
  - **Webhook + redirect plumbing**: the operator template adds the Netopia callback path (`/v1/finance/providers/netopia/callback`) to `publicPaths`, sets `vite.config.ts` `server.allowedHosts: true` (Cloudflare-tunnel friendly for dev webhook delivery), and ships a `/pay` resolver route + `POST /v1/public/payment-link/resolve?ref=` + `POST /v1/public/payment-link/:sessionId/retry` + `POST /v1/public/payment-link/:sessionId/start-card` so any orderID/clientReference echoed back by Netopia resolves to the canonical session id, lazy-starts the card path on demand, and supports retrying after a failed payment by minting a fresh session.

  Migration: if you were importing `createDemoFlightAdapter` from the old (template-internal) location, switch to `@voyantjs/plugin-flights-demo` and pass `{ baseUrl: env.FLIGHTS_DEMO_API_URL }`. Stand up the new service via `pnpm --filter flights-demo-api db:migrate && pnpm --filter flights-demo-api dev` (defaults to `:3320`). Drop the `demo_flight_orders` table from your operator DB — migration `0006_common_vance_astro` handles this idempotently for templates following the operator one.

### Patch Changes

- @voyantjs/catalog@0.20.0
- @voyantjs/db@0.20.0
