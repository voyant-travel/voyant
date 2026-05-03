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
   * Returns rich entity content for one entity_id, in one locale.
   * Distinct from liveResolve — this returns the durable detail-page
   * content (itinerary, media, options, terms), not volatile live
   * values.
   *
   * Capability-gated by `supportsContentFetch`. The catalog plane's
   * content cache calls this on a refresh cadence (TTL or drift event)
   * and stores the result in the per-vertical, per-locale content
   * table.
   */
  getContent?(
    ctx: SourceAdapterContext,
    request: GetContentRequest,
  ): Promise<GetContentResult>
}

export interface GetContentRequest {
  entity_module: string
  entity_id: string
  /** BCP 47 tag (e.g. "ro-RO", "de-DE", "en-GB"). Required — locale is
   *  load-bearing in this contract. See §3.5 for the full multi-
   *  language posture. */
  locale: string
  /** Other scope axes — kept separate from locale for clarity. */
  market?: string
  currency?: string
}

export interface GetContentResult {
  entity_module: string
  entity_id: string
  source_ref: string
  /** The locale this payload is in. May differ from request.locale
   *  when the upstream did its own fallback (e.g. requested ro-RO,
   *  returned en-GB because it had no Romanian content). The catalog
   *  plane records this so subsequent fallback decisions know what's
   *  actually cached vs. what was requested. */
  returned_locale: string
  /** True when the upstream marks the payload as machine-translated.
   *  Read paths can opt out of machine-translated rows for ops-side
   *  views (see §3.5.5). */
  machine_translated?: boolean
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
  /** BCP 47 tags this connection can serve content in. The catalog
   *  plane uses this to plan backfills (preload all deployment-
   *  configured locales) and to render an empty-state when the
   *  requested locale is not supported. Empty / absent → unknown,
   *  probe per-call. */
  supportedContentLocales?: ReadonlyArray<string>
}
```

Adapters that don't implement `getContent` (the demo upstream, simple bedbanks that only have prices) declare `supportsContentFetch: false`. The catalog plane then renders thin content from the indexer projection — same as today, no regression.

The locale field is required, not optional. Adapters that genuinely have only one locale (a single-language tour operator) accept any value and return their canonical content with `returned_locale` pointing at what they actually have. The contract is "tell me your best for this locale" — never "give me whatever you have."

### 3.2. Per-vertical content cache

Each vertical that needs rich content for sourced rows adds a sibling table mirroring its owned-content schema. **Per-vertical, not generic.** Cruises already proves the shape per-vertical works; we formalize the pattern.

The cache is keyed on **(entity_id, locale)** — each language is a separate row, mirroring the existing `product_translations` shape on the owned side. See §3.5 for the multi-language rationale.

Examples:

```sql
-- packages/products/src/schema-sourced-content.ts (new)
products_sourced_content (
  entity_id              text not null,           -- typeid: prod_*, matches catalog
  locale                 text not null,           -- BCP 47, e.g. "ro-RO"
  source_kind            text not null,
  source_ref             text not null,
  -- denormalized "content" payload, vertical-shaped
  payload                jsonb not null,          -- { product, options[], days[], media[] }
  returned_locale        text not null,           -- what the upstream actually served
  machine_translated     boolean not null default false,
  fetched_at             timestamptz not null,
  fresh_until            timestamptz,
  etag                   text,
  fetch_status           text not null,           -- "ok" | "stale" | "error" | "unsupported"
  fetch_error            text,
  primary key (entity_id, locale),
)
-- index on (locale, fresh_until)             — for "what's stale in ro-RO?"
-- index on (entity_id, returned_locale)      — for fallback diagnostics

-- packages/cruises/src/schema-sourced-content.ts (new)
-- replaces the cruises-routes.ts ad-hoc pattern with a shared cache
cruises_sourced_content (
  entity_id text, locale text, source_kind, source_ref, payload jsonb,
  returned_locale text, machine_translated bool, fetched_at, fresh_until,
  etag, fetch_status, fetch_error,
  primary key (entity_id, locale),
)

-- ... and so on per vertical that adopts the pattern ...
```

Why per-vertical rather than one big `catalog_content_cache(payload jsonb)` table:

- The vertical knows its content shape and can validate / migrate / index columns out of `payload` without coordinating with other verticals.
- Per-vertical TTLs and refresh policies make sense (a cruise content blob is much more stable than a hotel rate plan).
- Drift signals are per-vertical: cruise drift events care about sailing changes, hotel drift events care about room availability. Routing the cache invalidation through the vertical keeps responsibilities clean.
- Migration is safer: a problem in the products cache doesn't take out cruise rendering.

Why per-locale rows rather than `payload jsonb` keyed by locale: independent TTLs, independent fetch failures, simple "missing locale" SQL queries, per-locale invalidation on drift. See §3.5.2 for the full reasoning.

### 3.3. Read service with owned-vs-sourced dispatch

Each vertical exposes a `getContentForEntity(db, entityId, scope)` function that takes a locale preference chain and returns the best match:

```ts
export async function getProductContent(
  db: AnyDrizzleDb,
  entityId: string,
  scope: ContentScope,
): Promise<ContentLocaleResolution<ProductContent> | null> {
  const provenance = await readProvenance(db, "products", entityId)
  if (!provenance || provenance.source_kind === "owned") {
    // Owned path — read from the products tables (current implementation).
    // Owned content is locale-resolved against product_translations.
    return readOwnedProductContent(db, entityId, scope)
  }
  // Sourced path — pick the best cached locale row against the
  // preference chain (one query, no N+1; see §3.5.3).
  const adapter = sourceAdapterRegistry.resolveOrThrow(provenance.source_kind)
  const best = await pickBestCachedLocale(db, "products", entityId, scope)

  if (best && !isStale(best, scope)) {
    // Fresh cache hit — return it, no adapter round-trip.
    return resolveCached(best, scope)
  }

  if (best && isStale(best, scope)) {
    // SWR — return the stale row immediately, schedule a fire-and-
    // forget refresh so the *next* read sees fresh content. Concurrent
    // stale reads for the same (entity, locale) dedupe via the
    // singleflight registry below; only one adapter call is in flight
    // at a time.
    scheduleBackgroundRefresh(adapter, "products", entityId, scope)
    return resolveCached(best, scope)
  }

  // No cache row at all for any preferred locale — must block on the
  // adapter; we have nothing to serve.
  if (!adapter.getContent) {
    // Adapter declared no content fetch — fall back to thin content
    // synthesized from the indexer projection. Degraded mode.
    return synthesizeThinContent(db, "products", entityId, scope)
  }
  const fresh = await singleflight.do(
    cacheKey("products", entityId, scope.preferredLocales[0]),
    () => adapter.getContent!(adapterCtx, {
      entity_module: "products",
      entity_id: entityId,
      locale: scope.preferredLocales[0],
      market: scope.market,
      currency: scope.currency,
    }),
  )
  await writeCachedSourcedContent(db, "products", entityId, fresh)
  return resolveFresh(fresh, scope)
}
```

Detail routes (operator and storefront) call this single function. Owned products keep working unchanged. Sourced products read from cache (locale-resolved); adapters that don't support content fetch render a thin fallback synthesized from the indexed projection — degraded but not broken.

### 3.4. Refresh policy: SWR with singleflight

Two refresh paths, both invisible to operators:

1. **TTL** — `fresh_until` from the adapter, or a vertical default (cruises: 24h, hotels: 4h, products: 24h). On read, if `fresh_until < now()`, the read returns the **stale row immediately** and schedules a fire-and-forget refresh. Next read sees the fresh row. This is stale-while-revalidate (SWR): customer-facing latency is always cache latency, never adapter latency, even when the adapter is slow or briefly down.
2. **Drift events** — when a drift event fires for `(entity_module, entity_id)`, the catalog plane invalidates affected cache rows (sets `fresh_until = now()`). The next read serves stale + triggers refresh, same as TTL expiry.

Two correctness guards:

- **Singleflight on the cache key** — concurrent reads that all see "stale" or "miss" for the same `(entity_module, entity_id, locale)` collapse into one in-flight adapter call. Background refreshes triggered by SWR participate in the same registry, so a hot row never produces a thundering herd of `getContent` calls.
- **Cache miss is the one blocking case** — if there's no row at all in any preferred locale, the read MUST wait for the adapter (we have nothing to return). This is rare in steady state because backfill / first-discovery populates the cache before customer reads land on a row.

There is **no manual "refresh from source" admin action**. Operators don't think in cache terms; the cache is an internal optimization, not a surface they manage. If something is wrong, drift events handle it; if drift is missing, that's a bug in the adapter integration, not something an operator should be working around with a button.

Snapshot capture (§5.1) is the one exception that bypasses SWR: the booking engine MUST refresh synchronously at commit time so the snapshot reflects what the customer actually agreed to. That path is documented as refresh-with-fallback in §5.1 — it's not a read, it's a write-time freshness guarantee.

A pure-background scheduled refresher (a worker that walks expired rows and refreshes proactively) is **not planned**. SWR + drift events covers the same surface area without a worker, schedule, backlog monitor, or dead-letter queue. If we ever observe high p99 latency on first-reads of cold rows, we'd revisit — but that's a backfill problem, not a refresh problem.

## 3.5. Multi-language as a first-class axis

Voyant is multilingual at every layer of the catalog plane it already covers — the indexer is sliced per locale (`IndexerSlice.locale`), the overlay store is keyed on `(entity, field, locale, audience, market)`, owned products carry `product_translations` / `product_option_translations` / `option_unit_translations` tables, BCP 47 codes are the lingua franca (`@voyantjs/utils/languages`). **Sourced content has to match this posture.** Treating it as a "cache afterthought" — one canonical locale stored, translation deferred — silently degrades sourced rows everywhere a non-English customer or operator looks at one.

Real adapters reflect this:

- TUI Connect serves content in 20+ languages; an operator selling TUI inventory in Romania expects ro-RO content, an operator selling in Germany expects de-DE.
- Bedbanks (Hotelbeds, Expedia) routinely return descriptions per locale.
- Cruise lines often have CMS content per market (en-US for North America, en-GB + de + fr + es for Europe).

The catalog plane should not flatten that.

### 3.5.1. Adapter contract is locale-aware

The `getContent` request defined in §3.1 takes a required `locale` (BCP 47) and the result returns a `returned_locale` that may differ. This keeps the contract explicit — adapters MUST tell us which locale they served, no inference. `AdapterCapabilities.supportedContentLocales` lets adapters declare ahead of time which locales they can serve, so the catalog plane can plan backfills against deployment-configured locales without per-call probing.

When the upstream produced a machine translation (rather than authored content), the adapter sets `machine_translated: true`. The read service can be told to skip those rows in operator-side views (see §3.5.5).

### 3.5.2. Per-locale cache rows

The cache table from §3.2 is keyed on **(entity_id, locale)** rather than entity_id alone. Why per-locale rows rather than a single row with `payload jsonb` keyed by locale:

- **Per-locale TTLs.** TUI's de-DE content might refresh hourly, ro-RO daily. Independent `fresh_until` per row.
- **Per-locale fetch failures don't cascade.** If the adapter's en-GB endpoint times out, ro-RO content is still readable.
- **Backfill queries.** "Which products are missing fr-FR?" is a single SQL query against `(entity_id, locale)`; with a JSON map, it's a JSONB scan.
- **Per-locale invalidation on drift.** Drift events name a locale; we invalidate just that row.
- **Symmetric with `product_translations`.** Owned and sourced read paths can share more code.

### 3.5.3. Locale negotiation: read-side fallback chain

`getContentForEntity` takes a **preference chain**, not a single locale. Walks the chain until it finds a row, falls back gracefully when content for the requested locale doesn't exist:

```ts
export interface ContentLocaleRequest {
  /** Ordered preference, most-preferred first. The deployment's
   *  configured fallback chain is appended after caller's preference,
   *  so a ro-RO storefront request resolves like
   *  ["ro-RO", "ro", "en-GB", "en", "*any*"]. */
  preferredLocales: ReadonlyArray<string>
  /** When true, accept machine-translated content. False for ops-side
   *  views where operators want to see "real" content from the upstream
   *  before deciding whether to override. */
  acceptMachineTranslated?: boolean
}

export interface ContentLocaleResolution<T = unknown> {
  content: T
  /** Which locale was actually served. */
  served_locale: string
  /** "exact" — preference matched directly.
   *  "language_match" — language tag matched but region didn't (asked
   *      for "fr-CA", got "fr-FR").
   *  "fallback_chain" — fell through to a deployment-default locale.
   *  "any" — last resort, served whatever the cache had. */
  match_kind: "exact" | "language_match" | "fallback_chain" | "any"
  machine_translated: boolean
}
```

The read service does the chain walk in SQL: pull all available locales for the entity in one query, score them against the preference chain, return the best. One query, no N+1. When **no** locale is available (cache miss for every entry), fall through to the live adapter fetch with the most-preferred locale — same path as §3.3 today, just locale-aware.

### 3.5.4. Editorial overlays compose on top

The existing `catalog_overlay` table keys on `(entity, field_path, locale, audience, market)`. **Overlays already work per-locale.** For sourced rows, an operator can curate a `ro-RO` overlay on top of what the adapter served (or didn't serve) — same machinery. Overlay merge happens at read time after locale resolution: pick the best content row, then layer locale-matching overlays on top.

This means an operator can ship Romanian content for a TUI product *before* TUI publishes a ro-RO version — overlay covers it. When TUI later ships ro-RO natively, the operator can decide to keep their override (overlay wins) or remove it (fall back to the upstream).

### 3.5.5. Machine translation: opt-in policy, never implicit

Voyant does not auto-translate sourced content by default. When an operator chooses to (via deployment config: "fill missing locales by machine-translating from English"), the translator runs at content-fetch time and writes a row with `machine_translated: true`. The read service can be told `acceptMachineTranslated: false` to skip those rows in operator-side views.

Translation provider is wired via the existing pattern (Voyant Cloud AI gateway, OpenAI, DeepL, internal model — same provider story as embeddings). Out of scope for this doc; the contract is "machine_translated content rows exist, are flagged, and the read path can include or exclude them."

### 3.5.6. Backfill and supportedContentLocales

When a deployment configures its set of `DEFAULT_SLICES` (operator template ships with en-GB; storefronts add ro-RO, de-DE, etc.), an admin script can call `adapter.capabilities.supportedContentLocales` (when known) and preload content for every entity × deployment-locale matrix. Background job; out of v1 scope but the data shape supports it cleanly.

For adapters that don't declare `supportedContentLocales`, the cache populates lazily — first read in a new locale fetches and caches.

### 3.5.7. The journey + storefront

The booking journey's locale arrives via `BookingDraft.scope.locale` (set from `accept-language` for the storefront, from the operator's preference for admin). It flows down to:

- The Configure / Accommodation / Add-ons sub-step content via `getContentForEntity`.
- The descriptor's labels (`paxBands[].label`, `addonGroups[].label`) — which themselves come from the content layer, not hardcoded English.
- The pricing breakdown's line-item labels.

If the wizard runs in ro-RO and the upstream served en-GB content (no Romanian available), the `match_kind` and `served_locale` fields surface in the UI as a small "served in English" hint, so the customer knows. The booking still commits — fallback is a degradation, not a failure.

## 4. How the booking journey uses it

The journey's Configure / Accommodation / Add-ons steps need departure dates, room types, addon catalogs. Today these are pulled from per-vertical service layers for owned rows; sourced rows have nothing comparable.

After this lands:

- The journey's `BookingDraftShape` is populated by reading `getContentForEntity` and projecting the relevant slices into the descriptor (departures → `configureSubSteps[].kind: "departure"`; room types → `accommodationSubSteps[].kind: "rooms"`; addons → `addonGroups[]`).
- Live pricing in `quoteEntity` reads the same content for option-pricing computations.
- The owned-handler's existing pricing primitives apply unchanged; the sourced equivalent uses the adapter's content + adapter's `liveResolve` for prices.
- Storefront detail pages (`/products/$id`, `/cruises/$id`, etc.) read the same content function and render the full page identically for owned and sourced rows.

## 5. Snapshot relationship

When a sourced booking commits, the snapshot graph captures `frozenPayload`. Today that's the indexed projection. **After this proposal lands, `frozenPayload` includes the full content blob** so the booking row carries a deep audit-grade record of what was sold, not just the indexed fields.

The change to `captureSnapshot` callers (in the booking engine) is small — pull content + merge into the existing payload. The snapshot table schema already accepts opaque JSONB; no migration there.

### 5.1. At-commit content capture: refresh-with-fallback

The snapshot must reflect what the customer actually agreed to at the moment of commit, not whatever the cache happened to hold. So at commit time, the engine **refetches from the adapter** rather than reading the cache. If the refetch fails for any reason (network blip, rate limit, transient adapter outage), the engine **falls back to the cache** — the booking succeeds; the snapshot records whatever the most recent cached content was.

```
captureContentForSnapshot(adapter, entityModule, entityId, scope):
  try:
    fresh = adapter.getContent(ctx, { entity_module, entity_id, scope })
    writeCachedSourcedContent(db, ..., fresh)   // also refresh cache
    return { content: fresh.content, source: "fresh", fetched_at: now() }
  catch err:
    cached = readCachedSourcedContent(db, ..., includeStale: true)
    if cached:
      return { content: cached.payload, source: "cache_fallback",
               fetched_at: cached.fetched_at, fallback_reason: err.message }
    // No cache row at all → fail the commit. We do not commit a snapshot
    // with thin indexed-projection content; refunds and audit would have
    // nothing real to look at. Operator sees a clear actionable error.
    throw new SnapshotContentUnavailableError(...)
```

The snapshot row records both the content blob and a `content_capture` envelope so audit can later distinguish a fresh capture from a fallback:

```ts
// inside booking_catalog_snapshot.frozen_payload
{
  // ... existing fields ...
  content_capture: {
    source: "fresh" | "cache_fallback",
    fetched_at: "2026-...",
    fallback_reason?: string,    // present when source == "cache_fallback"
    content_etag?: string,       // mirrors GetContentResult.etag
  },
  content: { /* the vertical-shaped content payload */ },
}
```

**Why fail-on-no-cache rather than synthesize from the indexed projection.** The indexed projection is search-shaped — name, status, a handful of facets. It's not a record of "what was sold" in any audit-grade sense. Refunding a customer eight months later from a stub document with three fields is worse than the operator getting a clear, actionable error at commit time and resolving it (manual confirmation, retry with backoff during a soft hold, or escalating to the upstream).

### 5.2. The hold/commit timing in practice

For sourced rows, the engine usually places a hold via `adapter.reserve` with `payment_intent.type = "hold"` (soft-hold path) earlier in the journey. By commit time we've typically had a recent successful adapter round-trip, so the refresh-on-commit `getContent` call usually succeeds. The fallback path is for genuine edge cases: long-held drafts (operator sat on a quote for two hours and the upstream had a brief outage during commit), aggressive rate limits, partial outages.

If we observe `cache_fallback` rates above a small percentage in production, that's a signal to investigate — usually either an unstable upstream or a refresh window that's too narrow — not a routine outcome.

### 5.3. Owned bookings

Owned bookings don't go through `getContent` at all (the data is in our DB). Their snapshot reads from the vertical's owned-content service, which is always available. The refresh / fallback machinery is sourced-only.

## 6. Channel-push relationship

Channel push is the **outbound** direction of supplier integration: when a booking commits on Voyant, push it upstream to a channel manager / supplier API (e.g. TUI, Hotelbeds, Voyant Connect peer). It is a separate concern from this doc but is **closely related** because:

- The same adapter that fetches content (inbound) usually has a method for pushing bookings (outbound).
- The same `connection_id` carries credentials for both.
- Drift events on a row often imply both content refresh and push-availability.

See [`channel-push-architecture.md`](./channel-push-architecture.md) for the outbound design. The two architectures share the `SourceAdapter` contract and the registry; their methods are distinct.

## 7. Package layout

```
packages/catalog/src/adapter/contract.ts                      — extended with getContent + supportsContentFetch + supportedContentLocales
packages/catalog/src/services/content-service.ts              — isStale + drift→cache invalidation + singleflight registry + scheduleBackgroundRefresh
packages/<vertical>/src/schema-sourced-content.ts             — per-vertical content cache table (entity_id, locale)
packages/<vertical>/src/service-content.ts                    — getContentForEntity (owned-vs-sourced dispatch, SWR semantics)
packages/<vertical>/src/service-content-thin.ts               — synthesizeThinContent fallback
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

1. ~~**Content cache vs. catalog snapshot for "what was sold"** — at booking commit, we capture `frozenPayload`. Should that be the live content cache row, or should it be re-fetched from the adapter to get the freshest at-commit snapshot?~~ **Resolved (§5.1):** refresh from the adapter at commit, fall back to the cache on adapter error. If neither is available (no cache row AND adapter fails), fail the commit — we don't snapshot from the indexed projection because that's not audit-grade. The snapshot row records `content_capture.source: "fresh" | "cache_fallback"` so audit can tell the two apart later.
2. ~~**Multi-locale caching** — TUI returns content in `de-DE`; storefront serves a `ro-RO` user. Cache per locale, or cache one canonical and translate on read?~~ **Resolved (§3.5):** multi-language is a first-class axis. Adapters take a required `locale` and report `returned_locale`; the cache keys on `(entity_id, locale)` per vertical (independent TTLs, independent fetch failures, simple "missing locale" SQL); the read service walks a preference chain in one query and falls back gracefully. Machine translation is opt-in and flagged on the row, never implicit. Editorial overlays compose on top per locale.
3. ~~**Cache invalidation on overlay change** — editorial overlays already exist for owned content. Do they apply to sourced content too? If yes, is the merge done at read time or at content-fetch time?~~ **Resolved (§3.5.4):** overlays apply to sourced content using the same `catalog_overlay` machinery, keyed on `(entity, field_path, locale, audience, market)`. Merge happens at **read time** after locale resolution — pick the best content row, then layer locale-matching overlays on top. Operators can curate a `ro-RO` overlay before TUI publishes ro-RO natively, and overlay edits don't need to invalidate the content cache. Content-fetch-time merge would couple two independent edit paths and force a cache rewrite on every overlay change; read-time merge keeps them orthogonal. Cost is a small extra query per read, mitigated by the same caching the overlay store already uses for owned reads.
4. ~~**Background refresher vs inline-on-read** — Phase C ships inline; v2 considers background.~~ **Resolved (§3.4):** SWR in v1, no scheduled background refresher. Reads always return cached content immediately; stale rows trigger a fire-and-forget adapter refresh in the background so the next read is fresh. Singleflight collapses concurrent refreshes for the same key. A pure-background scheduled refresher is not planned — SWR + drift events covers the same surface without a worker / schedule / backlog monitor.
5. **Per-vertical thin-content synthesizer shape** — when an adapter declares `supportsContentFetch: false`, the fallback synthesizer reads the indexed projection and produces a thin content blob. What's its minimum-viable shape per vertical? Each vertical decides.
6. ~~**Stale-while-revalidate** — when a cache row is stale, do we serve it AND fire a background refresh, or block the read while refreshing?~~ **Resolved (§3.4):** SWR in v1. Stale-but-present rows serve immediately and schedule an async refresh; only true cache miss (no row in any preferred locale) blocks. The booking engine snapshot path (§5.1) deliberately bypasses SWR — snapshot writes need synchronous freshness, reads do not.

## 10. Related documents

- [`catalog-architecture.md`](./catalog-architecture.md) — Phase 1 foundation. The content cache is a sibling layer to the indexer, snapshot, and overlay.
- [`catalog-booking-engine.md`](./catalog-booking-engine.md) — the engine consumes content (Configure / Accommodation / Add-ons steps).
- [`booking-journey-architecture.md`](./booking-journey-architecture.md) — the journey UX. Phase B depends on this content layer being in place at least for the products vertical.
- [`channel-push-architecture.md`](./channel-push-architecture.md) — outbound supplier integration. Shares the `SourceAdapter` contract.
