# Catalog sourced content — architecture

Status: draft / proposal — pre-implementation
Audience: anyone designing how Voyant displays, caches, and books rich content from external upstream sources (TUI direct, Voyant Connect peers, GDS, bedbanks).

This document fills a real gap in the catalog plane: there is currently no shared infrastructure for **rich detail content** on sourced rows. Search-shaped projections live in the indexer; live-volatile values flow through `liveResolve`; booking-time snapshots are deep but post-commit. Between those, **no layer exists** for "give me this sourced row's itinerary, media, departure dates, terms, room types so I can render it on a detail page or feed it to the booking engine."

This means today:

- The cruises vertical wires `adapter.fetchCruise(sourceRef)` directly into its detail route, bypassing the catalog plane (`packages/cruises/src/routes.ts:265`). Vertical-specific. Not a shared pattern.
- The booking journey's Configure step needs departures, options, and room types — for sourced rows, those don't exist anywhere standard.
- Storefront templates can't render a sourced product's detail page the same way as an owned product's. "5-day Turkey tour from TUI" can land in search results but has no detail page that pulls TUI's itinerary / media / departure schedule.
- Operators can't browse the full content of a sourced row in admin without falling back to the upstream's own UI.

This is a **prerequisite for Phase B** of [`booking-journey-architecture.md`](./booking-journey-architecture.md). The journey's descriptor-driven UI assumes the engine can reach a sourced row's full content; today it can't.

## 1. What we mean by "content"

For owned products, "content" is the union of:

- Identity / lifecycle (name, status, dates, currency)
- Marketing copy (description, highlights, inclusions, exclusions)
- Media (gallery, hero, day-strip)
- Itinerary (day-by-day plan, services per day, included activities)
- Variants / options (room types, departure dates, fare classes, cabin categories)
- Operational metadata (cancellation policy, payment terms, supplier notes, requirements)
- Per-traveler requirements (passport / visa / health for the route)

For sourced products, **the same content needs to be reachable**, sourced from the upstream and cached locally. The shape per vertical varies (a cruise has cabin categories + sailings; a hotel has room types + rate plans + meal plans; a tour has days + services + departures), but every vertical needs a known place to read from.

Importantly, **content is NOT what gets indexed**. The indexer takes a search-shaped projection of *some* fields (name, status, facets). The content layer is a superset: everything the detail page and the booking engine need.

## 2. What's already in place

- **`SourceAdapter` contract** — `connect`, `discover`, `liveResolve`, `reserve`, `cancel`. None of these returns rich content. `discover` emits indexer-shaped projections; `liveResolve` is for volatile-live single-field reads. (`packages/catalog/src/adapter/contract.ts`)
- **`CatalogProjection`** — the shape `discover` returns. Field-policy-declared fields only. Not rich content. (`packages/catalog/src/adapter/contract.ts:79`)
- **`ResolvedView`** — overlay-merged indexer projection. Same depth as `CatalogProjection` plus editorial overrides. Still not rich content. (`packages/catalog/src/overlay/resolver.ts:55`)
- **`bookingCatalogSnapshot.frozenPayload`** — captured at book time. Deep, but only for committed bookings; can't be the source for a pre-book detail page. (`packages/catalog/src/snapshot/schema.ts`)
- **Cruises' ad-hoc fetch** — `CruiseAdapter.fetchCruise(sourceRef)` directly called from the cruises module's routes. Vertical-specific. Not part of the catalog-plane contract. (`packages/cruises/src/routes.ts:265`)
- **No cache table** — no `*_sourced_content`, `catalog_content_cache`, or similar exists.
- **Drift events** — fire on field-policy field changes; carry `before` and `after` values. They detect drift in *indexed* fields, not content drift.

The cruise-style ad-hoc pattern works for one vertical but doesn't generalize. We need a contract.

## 3. Proposed shape

Three new pieces:

1. A new **`SourceContentAdapter`** capability — adapters that can serve rich content declare it.
2. A **per-vertical content cache** — each vertical owns a table that mirrors its owned-content schema for sourced rows.
3. A **read service** with owned-vs-sourced dispatch — call one function, get content regardless of source.

### 3.1. Adapter contract extension

`SourceAdapter` gains an optional method:

```ts
export interface SourceAdapter {
  // ... existing methods unchanged ...

  /**
   * Returns rich entity content for one entity_id. Distinct from
   * liveResolve — this returns the durable detail-page content
   * (itinerary, media, options, terms), not volatile live values.
   *
   * Capability-gated by `supportsContentFetch`. The catalog plane's
   * content cache calls this on a refresh cadence (TTL or drift event)
   * and stores the result in the per-vertical content table.
   */
  getContent?(
    ctx: SourceAdapterContext,
    request: GetContentRequest,
  ): Promise<GetContentResult>
}

export interface GetContentRequest {
  entity_module: string
  entity_id: string
  /** Optional locale negotiation. */
  scope?: { locale?: string; market?: string; currency?: string }
}

export interface GetContentResult {
  entity_module: string
  entity_id: string
  source_ref: string
  /**
   * Vertical-specific content payload. The catalog plane treats it as
   * opaque; the vertical's content service knows how to read it. The
   * shape is the vertical's existing owned-content shape (e.g. for
   * products: { product, options[], days[], media[] }).
   */
  content: unknown
  /**
   * When the upstream considers this content fresh until. Hint for the
   * catalog plane's cache; not load-bearing if absent.
   */
  fresh_until?: Date
  /** ETag-style marker for HTTP-cache revalidation on the next pull. */
  etag?: string
}

export interface AdapterCapabilities {
  // ... existing ...
  /** Whether the adapter implements `getContent`. */
  supportsContentFetch?: boolean
}
```

Adapters that don't implement `getContent` (the demo upstream, simple bedbanks that only have prices) declare `supportsContentFetch: false`. The catalog plane then renders thin content from the indexer projection — same as today, no regression.

### 3.2. Per-vertical content cache

Each vertical that needs rich content for sourced rows adds a sibling table mirroring its owned-content schema. **Per-vertical, not generic.** Cruises already proves the shape per-vertical works; we formalize the pattern.

Examples:

```sql
-- packages/products/src/schema-sourced-content.ts (new)
products_sourced_content (
  entity_id              text pk,    -- typeid: prod_*, matches a row in catalog
  source_kind            text not null,
  source_ref             text not null,
  -- denormalized "content" payload, vertical-shaped
  payload                jsonb not null,    -- { product, options[], days[], media[] }
  fetched_at             timestamptz not null,
  fresh_until            timestamptz,
  etag                   text,
  fetch_status           text not null,     -- "ok" | "stale" | "error" | "unsupported"
  fetch_error            text,
)

-- packages/cruises/src/schema-sourced-content.ts (new)
-- replaces the cruises-routes.ts ad-hoc pattern with a shared cache
cruises_sourced_content (
  entity_id text pk, source_kind, source_ref, payload jsonb, fetched_at,
  fresh_until, etag, fetch_status, fetch_error,
)

-- ... and so on per vertical that adopts the pattern ...
```

Why per-vertical rather than one big `catalog_content_cache(payload jsonb)` table:

- The vertical knows its content shape and can validate / migrate / index columns out of `payload` without coordinating with other verticals.
- Per-vertical TTLs and refresh policies make sense (a cruise content blob is much more stable than a hotel rate plan).
- Drift signals are per-vertical: cruise drift events care about sailing changes, hotel drift events care about room availability. Routing the cache invalidation through the vertical keeps responsibilities clean.
- Migration is safer: a problem in the products cache doesn't take out cruise rendering.

### 3.3. Read service with owned-vs-sourced dispatch

Each vertical exposes a `getContentForEntity(db, entityId, scope)` function that:

```ts
export async function getProductContent(
  db: AnyDrizzleDb,
  entityId: string,
  scope: ContentScope,
): Promise<ProductContent | null> {
  const provenance = await readProvenance(db, "products", entityId)
  if (!provenance || provenance.source_kind === "owned") {
    // Owned path — read from the products tables (current implementation).
    return readOwnedProductContent(db, entityId, scope)
  }
  // Sourced path — read from the per-vertical content cache.
  const cached = await readCachedSourcedContent(db, "products", entityId, scope)
  if (cached && !isStale(cached, scope)) return cached.payload as ProductContent

  // Cache miss or stale — refresh through the adapter (registered in
  // the SourceAdapterRegistry) and cache the result.
  const adapter = sourceAdapterRegistry.resolveOrThrow(provenance.source_kind)
  if (!adapter.getContent) {
    // Adapter declared no content fetch — fall back to thin content
    // synthesized from the indexer projection. This is a degraded mode.
    return synthesizeThinContent(db, "products", entityId, scope)
  }
  const fresh = await adapter.getContent(adapterCtx, { entity_module: "products", entity_id: entityId, scope })
  await writeCachedSourcedContent(db, "products", entityId, fresh)
  return fresh.content as ProductContent
}
```

Detail routes (operator and storefront) call this single function. Owned products keep working unchanged. Sourced products read from cache or freshen via the adapter. Adapters that don't support content fetch render a thin fallback synthesized from the indexed projection — degraded but not broken.

### 3.4. Refresh policy

Three refresh paths:

1. **TTL** — `fresh_until` from the adapter, or a vertical default (cruises: 24h, hotels: 4h, products: 24h). On read, if `fresh_until < now()`, refresh inline before returning.
2. **Drift events** — when a drift event fires for `(entity_module, entity_id)`, the catalog plane invalidates that row's cache (sets `fresh_until = now()`). Next read refreshes.
3. **Manual** — admin "Refresh from source" button hits a route that calls `adapter.getContent` and updates the cache. Useful for debugging and post-incident recovery.

Refreshes happen **inline** on read for v1 (simple, no background job). At scale, a background refresher reads rows with `fresh_until < now()` and refreshes proactively to avoid latency on hot reads — that's a v2 concern.

## 4. How the booking journey uses it

The journey's Configure / Accommodation / Add-ons steps need departure dates, room types, addon catalogs. Today these are pulled from per-vertical service layers for owned rows; sourced rows have nothing comparable.

After this lands:

- The journey's `BookingDraftShape` is populated by reading `getContentForEntity` and projecting the relevant slices into the descriptor (departures → `configureSubSteps[].kind: "departure"`; room types → `accommodationSubSteps[].kind: "rooms"`; addons → `addonGroups[]`).
- Live pricing in `quoteEntity` reads the same content for option-pricing computations.
- The owned-handler's existing pricing primitives apply unchanged; the sourced equivalent uses the adapter's content + adapter's `liveResolve` for prices.
- Storefront detail pages (`/products/$id`, `/cruises/$id`, etc.) read the same content function and render the full page identically for owned and sourced rows.

## 5. Snapshot relationship

When a sourced booking commits, the snapshot graph captures `frozenPayload`. Today that's the indexed projection. **After this proposal lands, `frozenPayload` should include the content blob** so the booking row carries a deep audit-grade record of what was sold, not just the indexed fields.

The change to `captureSnapshot` callers (in the booking engine) is small — pull `getContentForEntity` and merge into the existing payload. The snapshot table schema already accepts opaque JSONB; no migration there.

## 6. Channel-push relationship

Channel push is the **outbound** direction of supplier integration: when a booking commits on Voyant, push it upstream to a channel manager / supplier API (e.g. TUI, Hotelbeds, Voyant Connect peer). It is a separate concern from this doc but is **closely related** because:

- The same adapter that fetches content (inbound) usually has a method for pushing bookings (outbound).
- The same `connection_id` carries credentials for both.
- Drift events on a row often imply both content refresh and push-availability.

See [`channel-push-architecture.md`](./channel-push-architecture.md) for the outbound design. The two architectures share the `SourceAdapter` contract and the registry; their methods are distinct.

## 7. Package layout

```
packages/catalog/src/adapter/contract.ts                      — extended with getContent + supportsContentFetch
packages/catalog/src/services/content-service.ts              — generic isStale + drift→cache invalidation helpers
packages/<vertical>/src/schema-sourced-content.ts             — per-vertical content cache table
packages/<vertical>/src/service-content.ts                    — getContentForEntity (owned-vs-sourced dispatch)
packages/<vertical>/src/service-content-thin.ts               — synthesizeThinContent fallback
templates/operator/scripts/refresh-sourced-content.ts         — admin batch refresher (optional)
```

Each vertical opts in. Verticals that don't yet have detail-page needs (extras, transfers) can defer adopting this — they fall back to thin indexed content, same as today.

## 8. Migration / rollout

**Phase A — Extend the contract** (1 day):
- Add `getContent` (optional) and `supportsContentFetch` to `SourceAdapter` and `AdapterCapabilities`.
- Pure typing change; no implementations yet. The demo adapter declares `supportsContentFetch: false`.

**Phase B — Generic service helpers** (1-2 days):
- Add `packages/catalog/src/services/content-service.ts` with `isStale`, `invalidateOnDrift`, and content-cache utilities.
- No vertical adopts yet.

**Phase C — Products vertical adopts** (3 days):
- Add `products_sourced_content` schema + service.
- Wire `getProductContent` (owned-vs-sourced dispatch).
- Operator template's product detail route uses the new service.
- Demo upstream remains thin (declares `supportsContentFetch: false`); detail page renders fallback content for demo products.

**Phase D — Cruises vertical migrates** (2-3 days):
- Replace the ad-hoc `adapter.fetchCruise()` pattern in `packages/cruises/src/routes.ts:265` with the new content-cache pattern.
- Cruises' adapter implements `getContent` (returning the existing `ExternalCruise` shape wrapped in `GetContentResult`).
- Detail route reads from cache; existing route shape stays the same from the caller's perspective.

**Phase E — Hospitality / charters / extras** (2-3 days each, as needed):
- Adopt the pattern per vertical when first sourced integration ships.

**Phase F — Booking journey integration** (parallel to journey Phase B):
- Journey's `BookingDraftShape` builder reads from `getContentForEntity`.
- Live pricing in `quoteEntity` consults content.
- Snapshot at commit captures content.

## 9. Open questions

1. **Content cache vs. catalog snapshot for "what was sold"** — at booking commit, we capture `frozenPayload`. Should that be the live content cache row, or should it be re-fetched from the adapter to get the freshest at-commit snapshot? Probably the latter; needs decision.
2. **Multi-locale caching** — TUI returns content in `de-DE`; storefront serves a `ro-RO` user. Cache per locale, or cache one canonical and translate on read? Vertical-specific decision; cache per locale per vertical for v1.
3. **Cache invalidation on overlay change** — editorial overlays already exist for owned content. Do they apply to sourced content too? If yes, is the merge done at read time or at content-fetch time? Lean toward read-time merge so overlay changes don't need to invalidate the content cache.
4. **Background refresher vs inline-on-read** — Phase C ships inline; v2 considers background. Defer until we see real latency.
5. **Per-vertical thin-content synthesizer shape** — when an adapter declares `supportsContentFetch: false`, the fallback synthesizer reads the indexed projection and produces a thin content blob. What's its minimum-viable shape per vertical? Each vertical decides.
6. **Stale-while-revalidate** — when a cache row is stale, do we serve it AND fire a background refresh, or block the read while refreshing? Block for v1 (simpler); SWR is a v2 ergonomic.

## 10. Related documents

- [`catalog-architecture.md`](./catalog-architecture.md) — Phase 1 foundation. The content cache is a sibling layer to the indexer, snapshot, and overlay.
- [`catalog-booking-engine.md`](./catalog-booking-engine.md) — the engine consumes content (Configure / Accommodation / Add-ons steps).
- [`booking-journey-architecture.md`](./booking-journey-architecture.md) — the journey UX. Phase B depends on this content layer being in place at least for the products vertical.
- [`channel-push-architecture.md`](./channel-push-architecture.md) — outbound supplier integration. Shares the `SourceAdapter` contract.
