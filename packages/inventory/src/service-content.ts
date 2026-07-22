// agent-quality: file-size exception -- owner: inventory; existing service module stays co-located until a dedicated split preserves behavior and tests.
/**
 * Product content service — `getProductContent` with owned-vs-sourced
 * dispatch, locale-resolved cache reads, SWR refresh, and synthesizer
 * fallback.
 *
 * One entry point per vertical; the catalog plane stays neutral about
 * per-vertical content shapes. Detail routes (operator and storefront)
 * call `getProductContent(db, entityId, scope, options)` and get back a
 * fully-resolved `ContentLocaleResolution<ProductContent>` regardless
 * of whether the row is owned or sourced.
 *
 * Owned rows (entities in the products table without a sourced-entry
 * row) read from the products tables directly — out of scope for this
 * file in v1; callers that need owned reads compose them around this
 * service. Phase D ships sourced + synthesizer; owned dispatch
 * narrows when first sourced template adopts.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.3, §3.4, §3.6.
 */

import {
  type ContentLocaleResolution,
  createInvalidateOnDrift,
  fetchOverlaysForEntity,
  type GetContentRequest,
  type GetContentResult,
  type InvalidateOnDrift,
  isStale,
  type ProvenanceReadResult,
  pickBestCachedLocale,
  readSourcedEntry,
  type SourceAdapter,
  type SourceAdapterContext,
  withContentRefreshLock,
} from "@voyant-travel/catalog"
import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq } from "drizzle-orm"

import {
  mergeOverlaysIntoProductContent,
  normalizeProductContentOverlay,
  PRODUCTS_CONTENT_SCHEMA_VERSION,
  type ProductContent,
  productContentSchema,
  validateProductContent,
} from "./content-shape.js"
import {
  PRODUCTS_CONTENT_MARKET_ANY,
  productsSourcedContentTable,
  type SelectProductsSourcedContent,
} from "./schema-sourced-content.js"
import { buildOwnedProductContent } from "./service-content-owned.js"
import {
  type SynthesizedProductContent,
  synthesizeProductContent,
} from "./service-content-synthesizer.js"

/** Default TTL when the adapter doesn't pin `fresh_until`. */
const PRODUCTS_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24h, per §3.4

export interface ProductContentScope {
  /**
   * Ordered locale preference, most-preferred first. The deployment's
   * configured fallback chain should be appended by the caller (e.g.
   * `["ro-RO", "ro", "en-GB", "en"]` for a ro-RO storefront request).
   */
  preferredLocales: ReadonlyArray<string>
  /** Optional market — `'*'` (any) by default. */
  market?: string
  /** Optional currency for SWR refresh. Not used by the cache. */
  currency?: string
  /**
   * When false, the read service skips machine-translated rows in
   * favor of the next-best non-MT match. False on operator-side views
   * where ops want to see "real" content before deciding to override.
   * Default: true (storefront-friendly).
   */
  acceptMachineTranslated?: boolean
}

export interface GetProductContentOptions {
  /**
   * Adapter registry — used to resolve the adapter for SWR refresh
   * and cache-miss fetches. Required because the read service needs
   * to know which adapter handles a given source_kind.
   */
  registry: SourceAdapterRegistry
  /**
   * Builds the per-call adapter context (typically supplies the
   * connection_id + correlation_id).
   */
  buildAdapterContext?: (adapter: SourceAdapter) => SourceAdapterContext
  /**
   * Optional sink for per-overlay diagnostics emitted by the
   * content-shape-aware merger.
   */
  onOverlayError?: (event: { field_path: string; reason: string }) => void
  /**
   * Bypass a fresh cache row and fetch directly from the source adapter.
   * Use this for volatile fields embedded in content payloads, such as
   * sourced departure capacity, where a 24h rich-content TTL is too coarse.
   */
  forceFresh?: boolean
  /**
   * Admin comparison reads set this false to see locale-resolved provider/owned
   * source content without applying editorial overlays.
   */
  applyOverlays?: boolean
}

/**
 * The successful result of a content read. Carries the resolved content
 * payload, locale-match metadata, and freshness markers so callers can
 * render UI hints ("served in English").
 */
export interface ResolvedProductContent {
  content: ProductContent
  resolution: ContentLocaleResolution<{ locale: string; payload: ProductContent }>
  provenance: ResolvedProductContentProvenance
  /** Where the resolved content came from. */
  source: "sourced-cache" | "sourced-fresh" | "synthesized" | "owned"
  /** True when the cache row was stale and a background refresh was scheduled. */
  served_stale: boolean
  /** True for synthesizer output. */
  synthesized: boolean
  /** True when the upstream marked this content machine-translated. */
  machine_translated: boolean
}

export interface ResolvedProductContentProvenance {
  source_kind: string
  source_provider?: string
  source_connection_id?: string
  source_ref?: string
}

/**
 * Read the rich product content for one entity, resolving locale
 * preference, applying overlays, and refreshing in the background when
 * stale. Returns `null` only when the entity is unknown (no
 * sourced-entry row, no owned row).
 */
export async function getProductContent(
  db: AnyDrizzleDb,
  entityId: string,
  scope: ProductContentScope,
  options: GetProductContentOptions,
): Promise<ResolvedProductContent | null> {
  const sourcedEntry = await readSourcedEntry(db, "products", entityId)

  if (!sourcedEntry) {
    // Owned-product path. Read from the products module's own tables
    // and project to ProductContent — locale resolution against
    // product_translations + product_option_translations uses the
    // same pickBestCachedLocale scoring the sourced cache reads use.
    // Overlay merge applies the same way it does for sourced rows.
    const owned = await buildOwnedProductContent(db, entityId, {
      preferredLocales: scope.preferredLocales,
    })
    if (!owned) return null
    const merged = await applyProductEditorialOverlays(db, entityId, owned.content, options)
    return {
      content: merged,
      resolution: {
        candidate: { locale: owned.servedLocale, payload: merged },
        served_locale: owned.servedLocale,
        match_kind: owned.matchKind,
      },
      provenance: { source_kind: "owned" },
      source: "owned",
      served_stale: false,
      synthesized: false,
      machine_translated: false,
    }
  }

  // Wrap the entry as a ProvenanceReadResult so the synthesizer can
  // consume it without re-reading.
  const provenance: Extract<ProvenanceReadResult, { kind: "sourced" }> = {
    kind: "sourced",
    provenance: {
      source_kind: sourcedEntry.source_kind,
      source_provider: sourcedEntry.source_provider ?? undefined,
      source_connection_id: sourcedEntry.source_connection_id ?? undefined,
      source_ref: sourcedEntry.source_ref ?? undefined,
      source_freshness: sourcedEntry.source_freshness,
      last_sourced_at: sourcedEntry.last_sourced_at ?? undefined,
    },
    entry_id: sourcedEntry.id,
    status: sourcedEntry.status,
    projection: sourcedEntry.projection,
    projection_etag: sourcedEntry.projection_etag,
    projection_seen_at: sourcedEntry.projection_seen_at,
    first_seen_at: sourcedEntry.first_seen_at,
    last_seen_at: sourcedEntry.last_seen_at,
  }
  const resultProvenance = sourcedEntryToContentProvenance(sourcedEntry)

  const adapter = sourcedEntry.source_connection_id
    ? (options.registry.resolveByConnection(sourcedEntry.source_connection_id) ??
      options.registry.byKind(sourcedEntry.source_kind)[0]?.adapter)
    : options.registry.byKind(sourcedEntry.source_kind)[0]?.adapter
  const adapterCtx: SourceAdapterContext = options.buildAdapterContext?.(adapter!) ?? {
    connection_id: sourcedEntry.source_connection_id ?? sourcedEntry.source_kind,
  }
  const market = scope.market ?? PRODUCTS_CONTENT_MARKET_ANY
  const acceptMT = scope.acceptMachineTranslated ?? true
  const ownsContentCache = adapter?.capabilities.ownsContentCache === true

  if (ownsContentCache) {
    if (!adapter?.getContent) {
      throw new Error(
        `products adapter for ${entityId} declares ownsContentCache but does not implement getContent`,
      )
    }
    const fresh = await fetchPassThroughContent(adapter, adapterCtx, {
      entity_module: "products",
      entity_id: entityId,
      locale: scope.preferredLocales[0] ?? "en-GB",
      market,
      currency: scope.currency,
    })
    return finalizeFresh(db, entityId, fresh, scope, options, resultProvenance)
  }

  if (options.forceFresh && adapter?.getContent) {
    const fresh = await fetchFreshContent(
      db,
      adapter,
      adapterCtx,
      {
        entity_module: "products",
        entity_id: entityId,
        locale: scope.preferredLocales[0] ?? "en-GB",
        market,
        currency: scope.currency,
      },
      options,
    )
    if (fresh) {
      return finalizeFresh(db, entityId, fresh, scope, options, resultProvenance)
    }
  }

  // 1. Look up cached candidates across all locales for this entity.
  const cachedRows = await fetchCacheCandidates(db, entityId, market)
  const eligibleRows = acceptMT ? cachedRows : cachedRows.filter((r) => !r.machine_translated)

  const best = pickBestCachedLocale(
    eligibleRows.map((row) => ({ ...row, locale: row.locale })),
    scope.preferredLocales,
  )

  const shouldRefreshLegacyAvailability = best
    ? hasLegacyDepartureAvailabilityGap(best.candidate)
    : false

  if (best && !isStale(best.candidate) && !shouldRefreshLegacyAvailability) {
    return finalizeFromCache(db, entityId, best, "sourced-cache", false, options, resultProvenance)
  }

  if (best && (isStale(best.candidate) || shouldRefreshLegacyAvailability)) {
    // SWR for ordinary stale reads. Legacy demo content without
    // departure capacity is refreshed synchronously so operator
    // availability surfaces do not show effectively-unlimited slots.
    if (adapter?.getContent) {
      const refreshRequest = {
        entity_module: "products",
        entity_id: entityId,
        locale: scope.preferredLocales[0] ?? best.candidate.locale,
        market,
        currency: scope.currency,
      }
      if (shouldRefreshLegacyAvailability) {
        const fresh = await fetchFreshContent(db, adapter, adapterCtx, refreshRequest, options)
        if (fresh) return finalizeFresh(db, entityId, fresh, scope, options, resultProvenance)
      } else {
        void scheduleRefresh(db, adapter, adapterCtx, refreshRequest)
      }
    }
    return finalizeFromCache(db, entityId, best, "sourced-cache", true, options, resultProvenance)
  }

  // No cache row at all — must produce content somehow.
  if (!adapter?.getContent) {
    // Thin adapter or no adapter registered — synthesize from
    // projection + overlay + plane metadata (§3.6).
    const overlays = await fetchOverlaysForEntity(db, "products", entityId)
    const synthesized = synthesizeProductContent(
      { locale: scope.preferredLocales[0] ?? "en-GB" },
      {
        provenance,
        overlays: overlays.map((o) => ({ field_path: o.field_path, value: o.value })),
      },
    )
    return wrapSynthesized(synthesized, scope, false, resultProvenance)
  }

  // Cache miss with a rich adapter — block on the adapter, dedupe
  // across workers via advisory lock, and write through to the cache.
  const fresh = await fetchFreshContent(
    db,
    adapter,
    adapterCtx,
    {
      entity_module: "products",
      entity_id: entityId,
      locale: scope.preferredLocales[0] ?? "en-GB",
      market,
      currency: scope.currency,
    },
    options,
  )
  if (!fresh) {
    // The adapter call could not get the lock AND there's no cached
    // row — fall back to synthesizer rather than blocking forever.
    const overlays = await fetchOverlaysForEntity(db, "products", entityId)
    const synthesized = synthesizeProductContent(
      { locale: scope.preferredLocales[0] ?? "en-GB" },
      {
        provenance,
        overlays: overlays.map((o) => ({ field_path: o.field_path, value: o.value })),
      },
    )
    return wrapSynthesized(synthesized, scope, false, resultProvenance)
  }

  return finalizeFresh(db, entityId, fresh, scope, options, resultProvenance)
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache candidates
// ─────────────────────────────────────────────────────────────────────────────

async function fetchCacheCandidates(
  db: AnyDrizzleDb,
  entityId: string,
  market: string,
): Promise<SelectProductsSourcedContent[]> {
  const rows = await db
    .select()
    .from(productsSourcedContentTable)
    .where(
      and(
        eq(productsSourcedContentTable.entity_id, entityId),
        eq(productsSourcedContentTable.market, market),
        eq(productsSourcedContentTable.content_schema_version, PRODUCTS_CONTENT_SCHEMA_VERSION),
      ),
    )
  return rows
}

function hasLegacyDepartureAvailabilityGap(row: SelectProductsSourcedContent): boolean {
  const validation = validateProductContent(row.payload)
  if (!validation.valid) return false
  return validation.content.departures.some(
    (departure) => departure.capacity == null && departure.remaining == null,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Fresh fetch + write-through
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPassThroughContent(
  adapter: SourceAdapter,
  ctx: SourceAdapterContext,
  request: GetContentRequest,
): Promise<GetContentResult> {
  const got = await adapter.getContent!(ctx, request)
  const validation = validateProductContent(got.content)
  if (!validation.valid) {
    throw new Error(
      `products getContent for ${request.entity_id} failed validation: ${validation.reason}`,
    )
  }
  return got
}

async function fetchFreshContent(
  db: AnyDrizzleDb,
  adapter: SourceAdapter,
  ctx: SourceAdapterContext,
  request: GetContentRequest,
  _options: GetProductContentOptions,
): Promise<GetContentResult | null> {
  const result = await withContentRefreshLock(
    db,
    {
      entityModule: request.entity_module,
      entityId: request.entity_id,
      locale: request.locale,
      market: request.market,
    },
    async () => {
      const got = await adapter.getContent!(ctx, request)
      const validation = validateProductContent(got.content)
      if (!validation.valid) {
        // Surface adapter integration bugs, but don't write to cache.
        throw new Error(
          `products getContent for ${request.entity_id} failed validation: ${validation.reason}`,
        )
      }
      await writeCacheRow(db, request, got)
      return got
    },
  )
  return result ?? null
}

function scheduleRefresh(
  db: AnyDrizzleDb,
  adapter: SourceAdapter,
  ctx: SourceAdapterContext,
  request: GetContentRequest,
): void {
  // Fire-and-forget. Errors are swallowed — a failed refresh just
  // leaves the stale row in place; the next read tries again.
  void withContentRefreshLock(
    db,
    {
      entityModule: request.entity_module,
      entityId: request.entity_id,
      locale: request.locale,
      market: request.market,
    },
    async () => {
      const got = await adapter.getContent!(ctx, request)
      const validation = validateProductContent(got.content)
      if (!validation.valid) return
      await writeCacheRow(db, request, got)
    },
  ).catch(() => {
    // intentionally swallow — see comment above
  })
}

async function writeCacheRow(
  db: AnyDrizzleDb,
  request: GetContentRequest,
  result: GetContentResult,
): Promise<void> {
  const market = request.market ?? PRODUCTS_CONTENT_MARKET_ANY
  const now = new Date()
  // Date-like fields may arrive as strings when the adapter is an HTTP
  // client (JSON.parse doesn't deserialize ISO timestamps to Date).
  // Coerce at the cache-write boundary so the drizzle timestamp column
  // gets a real Date — `value.toISOString is not a function` otherwise.
  const sourceUpdatedAt = toDateOrNull(result.source_updated_at)
  const freshUntil =
    toDateOrNull(result.fresh_until) ?? new Date(now.getTime() + PRODUCTS_DEFAULT_TTL_MS)

  await db
    .insert(productsSourcedContentTable)
    .values({
      entity_id: request.entity_id,
      locale: request.locale,
      market,
      payload: result.content as Record<string, unknown>,
      content_schema_version: result.content_schema_version,
      returned_locale: result.returned_locale,
      machine_translated: result.machine_translated ?? false,
      source_updated_at: sourceUpdatedAt,
      fetched_at: now,
      fresh_until: freshUntil,
      etag: result.etag ?? null,
      fetch_status: "ok",
      fetch_error: null,
    })
    .onConflictDoUpdate({
      target: [
        productsSourcedContentTable.entity_id,
        productsSourcedContentTable.locale,
        productsSourcedContentTable.market,
      ],
      set: {
        payload: result.content as Record<string, unknown>,
        content_schema_version: result.content_schema_version,
        returned_locale: result.returned_locale,
        machine_translated: result.machine_translated ?? false,
        source_updated_at: sourceUpdatedAt,
        fetched_at: now,
        fresh_until: freshUntil,
        etag: result.etag ?? null,
        fetch_status: "ok",
        fetch_error: null,
      },
    })
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// ─────────────────────────────────────────────────────────────────────────────
// Finalizers — overlay merge + return shape
// ─────────────────────────────────────────────────────────────────────────────

async function finalizeFromCache(
  db: AnyDrizzleDb,
  entityId: string,
  best: NonNullable<ReturnType<typeof pickBestCachedLocale<SelectProductsSourcedContent>>>,
  source: "sourced-cache",
  servedStale: boolean,
  options: GetProductContentOptions,
  provenance: ResolvedProductContentProvenance,
): Promise<ResolvedProductContent> {
  const cachedPayload = best.candidate.payload
  const validation = validateProductContent(cachedPayload)
  if (!validation.valid) {
    // Schema-version-mismatch case is filtered upstream; if we hit
    // here, the cache row is corrupt for some other reason. Treat as
    // cache miss → caller's next layer (synthesizer) handles.
    throw new Error(
      `products cache row for ${entityId} (${best.candidate.locale}) failed validation: ${validation.reason}`,
    )
  }
  const cachedContent = validation.content
  const merged = await applyProductEditorialOverlays(db, entityId, cachedContent, options)
  return {
    content: merged,
    resolution: {
      candidate: { locale: best.candidate.locale, payload: merged },
      served_locale: best.candidate.returned_locale,
      match_kind: best.match_kind,
    },
    provenance,
    source,
    served_stale: servedStale,
    synthesized: false,
    machine_translated: best.candidate.machine_translated,
  }
}

async function finalizeFresh(
  db: AnyDrizzleDb,
  entityId: string,
  fresh: GetContentResult,
  scope: ProductContentScope,
  options: GetProductContentOptions,
  provenance: ResolvedProductContentProvenance,
): Promise<ResolvedProductContent> {
  const cachedContent = productContentSchema.parse(fresh.content)
  const merged = await applyProductEditorialOverlays(db, entityId, cachedContent, options)
  return {
    content: merged,
    resolution: {
      candidate: { locale: scope.preferredLocales[0] ?? fresh.returned_locale, payload: merged },
      served_locale: fresh.returned_locale,
      match_kind: scope.preferredLocales[0] === fresh.returned_locale ? "exact" : "language_match",
    },
    provenance,
    source: "sourced-fresh",
    served_stale: false,
    synthesized: false,
    machine_translated: fresh.machine_translated ?? false,
  }
}

async function applyProductEditorialOverlays(
  db: AnyDrizzleDb,
  entityId: string,
  content: ProductContent,
  options: GetProductContentOptions,
): Promise<ProductContent> {
  if (options.applyOverlays === false) return content
  const overlays = await fetchOverlaysForEntity(db, "products", entityId)
  return mergeOverlaysIntoProductContent(
    content,
    overlays.map((o) =>
      normalizeProductContentOverlay({
        id: o.id,
        version: o.version,
        node_kind: o.node_kind,
        node_key: o.node_key,
        field_path: o.field_path,
        value: o.value,
      }),
    ),
    {
      onOverlayError: options.onOverlayError
        ? (e) =>
            options.onOverlayError!({
              field_path: e.overlay.field_path,
              reason: e.reason,
            })
        : undefined,
    },
  )
}

function wrapSynthesized(
  synthesized: SynthesizedProductContent,
  scope: ProductContentScope,
  servedStale: boolean,
  provenance: ResolvedProductContentProvenance,
): ResolvedProductContent {
  return {
    content: synthesized.content,
    resolution: {
      candidate: { locale: synthesized.served_locale, payload: synthesized.content },
      served_locale: synthesized.served_locale,
      match_kind: scope.preferredLocales[0] === synthesized.served_locale ? "exact" : "any",
    },
    provenance,
    source: "synthesized",
    served_stale: servedStale,
    synthesized: true,
    machine_translated: false,
  }
}

function sourcedEntryToContentProvenance(sourcedEntry: {
  source_kind: string
  source_provider?: string | null
  source_connection_id?: string | null
  source_ref?: string | null
}): ResolvedProductContentProvenance {
  return {
    source_kind: sourcedEntry.source_kind,
    ...(sourcedEntry.source_provider ? { source_provider: sourcedEntry.source_provider } : {}),
    ...(sourcedEntry.source_connection_id
      ? { source_connection_id: sourcedEntry.source_connection_id }
      : {}),
    ...(sourcedEntry.source_ref ? { source_ref: sourcedEntry.source_ref } : {}),
  }
}

/**
 * Drift event consumer — sets `fresh_until = now()` on every cache row
 * matching the event's (entity_module, entity_id [, locale [, market]])
 * scope. The next read serves stale + schedules a SWR refresh.
 *
 * Templates subscribe this to the catalog plane's drift-event bus.
 * Per sourced-content §3.4.1.
 */
export const invalidateProductContentOnDrift: InvalidateOnDrift = createInvalidateOnDrift(
  productsSourcedContentTable,
  { entityModule: "products" },
)
