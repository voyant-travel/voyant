# @voyantjs/catalog

Catalog plane foundation for Voyant. The shared cross-cutting infrastructure that vertical modules — `products`, `cruises`, `accommodations`, `charters`, `extras` — adopt to participate in a normalized discovery / overlay / snapshot / search surface.

This is **Phase 1** of the catalog plane. Phase 2 (semantic search, embeddings, AI agent access via MCP) ships in `@voyantjs/catalog-rag`. Phase 3 (the flights vertical, the swappable `ReferenceDataProvider`) ships in `@voyantjs/flights`.

See [`docs/architecture/catalog-architecture.md`](../../docs/architecture/catalog-architecture.md) for the full design.

## Install

```bash
pnpm add @voyantjs/catalog
```

## What's in the box

- **`./contract`** — `FieldPolicy` type and the eleven governance enums. The load-bearing schema decision: every field on every CatalogEntry is declared with a row in a per-vertical policy file.
- **`./provenance`** — `Provenance` shape (`source_kind`, `source_ref`, `source_freshness`) carried by every CatalogEntry.
- **`./overlay/schema`** — drizzle table schema for editorial overrides keyed `(entity_module, entity_id, field_path, locale, audience, market)`.
- **`./overlay/resolver`** — resolver-merge logic with full locale × audience × market fallback chain.
- **`./snapshot/schema`** — `booking_catalog_snapshot` table for immutable booking-time CatalogEntry views.
- **`./indexer/contract`** — engine-agnostic `IndexerAdapter` contract.
- **`./indexer/typesense`** — native Typesense implementation, the v1 default.
- **`./search/rerank`** — Tier 2 two-stage-search orchestration helper for browse-time pricing.
- **`./drift/events`** — drift event types for upstream change detection.
- **`./events/taxonomy`** — catalog event names + visibility-filtered payload builders, emitted via `@voyantjs/core/events` and consumed by the existing webhook pipeline.
- **`./adapter/contract`** — public source-adapter contract. Voyant Connect, third-party providers, operator-built adapters all implement this.
- **`./adapter/schemas`** — zod schemas for source-adapter runtime payloads. Use these at HTTP, queue, RPC, and adapter boundaries instead of re-declaring validators.
- **`./booking-engine`** — quote/book services plus the Hono route module that backs `@voyantjs/catalog-react/booking-engine` and `@voyantjs/bookings-ui/journey`.

## Architectural rules

The catalog plane is a **contract**, not a polymorphic root. Vertical modules keep their own schemas and adopt this contract; they do not share a row shape. See the architecture doc for the full rationale.

- Per-vertical operational truth — separate tables per vertical.
- Shared cross-cutting infrastructure — overlay store, snapshot graph, indexer pipeline, drift events, webhooks.
- Three composition patterns — nested fields, promoted child entities, referenced CatalogEntries.
- Three variant axes on overlays — `locale`, `audience`, `market`; sparse, default deployment uses two audiences and one market.

## Usage

The catalog plane is consumed by vertical modules; templates wire it together.

```typescript
import { defineFieldPolicy } from "@voyantjs/catalog/contract"

export const productCatalogPolicy = defineFieldPolicy([
  {
    path: "title",
    class: "merchandisable",
    merge: "replace",
    drift: "medium",
    reindex: "entry-locale",
    snapshot: "on-book",
    query: "indexed-column",
    localized: true,
    visibility: ["staff", "customer", "partner"],
    editRole: "marketing",
    overrideFriction: "none",
    sourceFreshness: "sync",
  },
  // ...
])
```

See `docs/architecture/catalog-architecture.md` for the full contract and worked examples.

## Source-adapter runtime validation

```typescript
import { reserveRequestSchema } from "@voyantjs/catalog/adapter/schemas"
import type { ReserveRequest } from "@voyantjs/catalog/adapter/contract"

const request: ReserveRequest = reserveRequestSchema.parse(await req.json())
```

Reserve and cancel requests may include a `scope` matching live resolution plus
an `idempotency_key`; cancel results may return `status: "pending"` with
`pending_channel` for async upstream workflows.

## BookingJourney HTTP routes

`@voyantjs/catalog` exports `createCatalogBookingHonoModule(...)` and
`createCatalogBookingRoutes(...)` for the BookingJourney server contract. The
same functions remain available from `@voyantjs/catalog/booking-engine` for
consumers that prefer the narrower subpath. The module mounts the shared quote,
draft, hold, and book endpoints on both catalog API surfaces:

- `/v1/admin/catalog/*`
- `/v1/public/catalog/*`

Templates provide the runtime dependencies instead of the package importing
deployment code:

```typescript
import { createCatalogBookingHonoModule } from "@voyantjs/catalog"

export const catalogBookingModule = createCatalogBookingHonoModule({
  resolveDb: (c) => c.get("db"),
  resolveSourceRegistry: (c) => getBookingEngineRegistryFromContext(c),
  resolveOwnedHandlers: (c) => getOwnedBookingHandlerRegistryFromContext(c),
})
```

Apps that protect public routes by default must allow
`/v1/public/catalog`. Template-specific routes such as slots, admin order
management, checkout start, and booking snapshot enrichment stay in the
template.

## Catalog search HTTP routes

`@voyantjs/catalog` also exports `createCatalogSearchHonoModule(...)`,
`createCatalogSearchRoutes(...)`, and `mountCatalogSearchRoutes(...)` for the
plain JSON catalog search endpoint used by admin and storefront UIs:

- `POST /v1/admin/catalog/search`
- `POST /v1/public/catalog/search`

The module owns audience defaults: admin search uses the runtime
`defaultScope.audience`, while public search defaults to the `customer`
projection. Deployments provide the indexer and optional semantic executor per
request:

```typescript
import { createCatalogSearchHonoModule } from "@voyantjs/catalog"
import { executeSemanticSearch, type EmbeddingProvider } from "@voyantjs/catalog-rag"

export const catalogSearchModule = createCatalogSearchHonoModule({
  resolveRuntime: (c) => buildCatalogSearchRuntime(c),
  executeSearch: ({ adapter, embeddings, slice, request }) =>
    executeSemanticSearch({
      adapter,
      embeddings: embeddings as EmbeddingProvider | undefined,
      slice,
      request,
    }),
})
```

Search defaults to hybrid mode, downgrades to keyword when no embeddings are
available, and retries semantic/hybrid execution as keyword when the semantic
path fails. Pass `fallbackToKeywordOnSearchError: false` to fail closed instead.
