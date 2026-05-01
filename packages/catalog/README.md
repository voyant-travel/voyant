# @voyantjs/catalog

Catalog plane foundation for Voyant. The shared cross-cutting infrastructure that vertical modules — `products`, `cruises`, `hospitality`, `charters`, `extras` — adopt to participate in a normalized discovery / overlay / snapshot / search surface.

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
