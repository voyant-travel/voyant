# `@voyant-travel/plugin-catalog-demo`

Thin `SourceAdapter` HTTP client for the catalog booking engine.

This package contains zero state and zero business logic — every method
round-trips to the standalone [`catalog-demo-api`](../../../apps/catalog-demo-api)
service. Drop or swap the plugin to point at a real upstream (Voyant
Connect peer, TUI direct API, Hotelbeds, GDS) without touching any
template tables.

## What it provides

- `createDemoCatalogAdapter({ baseUrl })` — returns a `SourceAdapter`
  whose lifecycle methods (`connect`, `pause`, `disconnect`, `getState`,
  `discover`, `liveResolve`, `reserve`, `cancel`) all hit endpoints on
  the demo-api.
- `kind: "demo"` and default `verticals: ["products"]`. Pass
  `verticals: ["products", "cruises", "accommodations"]` for
  multi-vertical demo catalog sync.
- Capability declaration: `supportsLiveResolution`, `supportsBookingForwarding`,
  `postBookOperations: ["cancel", "status"]`.

The demo catalog API serves vertical-specific discovery and content payloads for
products, cruises, and accommodations. The adapter rejects unsupported verticals
instead of advertising content routes that the demo API cannot serve.

It does **not** implement `freshnessCheck` (no upstream to check) or
`onDrift` (no drift signal). The plugin is purely synchronous fetch
calls; concurrency is the caller's concern.

## Usage

```ts
import { createDemoCatalogAdapter } from "@voyant-travel/plugin-catalog-demo"
import { createSourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"

const registry = createSourceAdapterRegistry()
registry.register(createDemoCatalogAdapter({ baseUrl: process.env.CATALOG_DEMO_API_URL }))
```

Templates that don't set `CATALOG_DEMO_API_URL` simply skip the
registration — the booking engine's `NoAdapterRegisteredError` surfaces
on any subsequent attempt to dispatch a `demo` row.

## Source kind

Every projection the demo-api emits carries `source.kind: "demo"` and
`source.ref: <inventory.id>`. The catalog UI's "Source" column renders
this as **Demo**.

## Running the demo-api

The demo service is a separate Hono app at `apps/catalog-demo-api`.
Quickstart:

```bash
cd apps/catalog-demo-api
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm dev   # listens on :3330
```

## License

Apache-2.0
