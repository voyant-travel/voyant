/**
 * Accommodation content service — `getAccommodationContent` with locale-
 * resolved cache reads, SWR refresh, and synthesizer fallback.
 *
 * Mirrors `service-content.ts` in the products and cruises packages
 * but accommodation-shaped. The accommodation content aggregate (§3.2 /
 * §3.6) is `{ hotel, room_types[], rate_plans[], meal_plans[],
 * amenities[], policies[] }` — one payload returned by a single
 * getContent. Pricing stays out (volatile-live, flows through
 * `liveResolve`); rate plans here are the structural plan definitions,
 * not their per-night rates.
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
} from "@voyantjs/catalog"
import type { SourceAdapterRegistry } from "@voyantjs/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { and, eq } from "drizzle-orm"

import {
  ACCOMMODATION_CONTENT_SCHEMA_VERSION,
  type AccommodationContent,
  accommodationContentSchema,
  mergeOverlaysIntoAccommodationContent,
  validateAccommodationContent,
} from "./content-shape.js"
import {
  ACCOMMODATION_CONTENT_MARKET_ANY,
  accommodationSourcedContentTable,
  type SelectAccommodationSourcedContent,
} from "./schema-sourced-content.js"
import {
  type SynthesizedAccommodationContent,
  synthesizeAccommodationContent,
} from "./service-content-synthesizer.js"

/**
 * Accommodation cache TTL is 4h by default — significantly shorter than
 * products / cruises because room availability and rate plans churn
 * faster on bedbanks. Per §3.4: products 24h, hotels 4h.
 */
const ACCOMMODATION_DEFAULT_TTL_MS = 4 * 60 * 60 * 1000

export interface AccommodationContentScope {
  preferredLocales: ReadonlyArray<string>
  market?: string
  currency?: string
  acceptMachineTranslated?: boolean
}

export interface GetAccommodationContentOptions {
  registry: SourceAdapterRegistry
  buildAdapterContext?: (adapter: SourceAdapter) => SourceAdapterContext
  onOverlayError?: (event: { field_path: string; reason: string }) => void
}

export interface ResolvedAccommodationContent {
  content: AccommodationContent
  resolution: ContentLocaleResolution<{ locale: string; payload: AccommodationContent }>
  source: "sourced-cache" | "sourced-fresh" | "synthesized"
  served_stale: boolean
  synthesized: boolean
  machine_translated: boolean
}

export async function getAccommodationContent(
  db: AnyDrizzleDb,
  entityId: string,
  scope: AccommodationContentScope,
  options: GetAccommodationContentOptions,
): Promise<ResolvedAccommodationContent | null> {
  const sourcedEntry = await readSourcedEntry(db, "accommodations", entityId)
  if (!sourcedEntry) return null

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

  const adapter = sourcedEntry.source_connection_id
    ? (options.registry.resolveByConnection(sourcedEntry.source_connection_id) ??
      options.registry.byKind(sourcedEntry.source_kind)[0]?.adapter)
    : options.registry.byKind(sourcedEntry.source_kind)[0]?.adapter
  const adapterCtx: SourceAdapterContext = options.buildAdapterContext?.(adapter!) ?? {
    connection_id: sourcedEntry.source_connection_id ?? sourcedEntry.source_kind,
  }
  const market = scope.market ?? ACCOMMODATION_CONTENT_MARKET_ANY
  const acceptMT = scope.acceptMachineTranslated ?? true

  const cachedRows = await fetchCacheCandidates(db, entityId, market)
  const eligibleRows = acceptMT ? cachedRows : cachedRows.filter((r) => !r.machine_translated)

  const best = pickBestCachedLocale(
    eligibleRows.map((row) => ({ ...row, locale: row.locale })),
    scope.preferredLocales,
  )

  if (best && !isStale(best.candidate)) {
    return finalizeFromCache(db, entityId, best, false, options)
  }

  if (best && isStale(best.candidate)) {
    if (adapter?.getContent) {
      void scheduleRefresh(db, adapter, adapterCtx, {
        entity_module: "accommodations",
        entity_id: entityId,
        locale: scope.preferredLocales[0] ?? best.candidate.locale,
        market,
        currency: scope.currency,
      })
    }
    return finalizeFromCache(db, entityId, best, true, options)
  }

  if (!adapter?.getContent) {
    const overlays = await fetchOverlaysForEntity(db, "accommodations", entityId)
    const synthesized = synthesizeAccommodationContent(
      { locale: scope.preferredLocales[0] ?? "en-GB" },
      {
        provenance,
        overlays: overlays.map((o) => ({ field_path: o.field_path, value: o.value })),
      },
    )
    return wrapSynthesized(synthesized, scope, false)
  }

  const fresh = await fetchFreshContent(db, adapter, adapterCtx, {
    entity_module: "accommodations",
    entity_id: entityId,
    locale: scope.preferredLocales[0] ?? "en-GB",
    market,
    currency: scope.currency,
  })
  if (!fresh) {
    const overlays = await fetchOverlaysForEntity(db, "accommodations", entityId)
    const synthesized = synthesizeAccommodationContent(
      { locale: scope.preferredLocales[0] ?? "en-GB" },
      {
        provenance,
        overlays: overlays.map((o) => ({ field_path: o.field_path, value: o.value })),
      },
    )
    return wrapSynthesized(synthesized, scope, false)
  }

  return finalizeFresh(db, entityId, fresh, scope, options)
}

async function fetchCacheCandidates(
  db: AnyDrizzleDb,
  entityId: string,
  market: string,
): Promise<SelectAccommodationSourcedContent[]> {
  return db
    .select()
    .from(accommodationSourcedContentTable)
    .where(
      and(
        eq(accommodationSourcedContentTable.entity_id, entityId),
        eq(accommodationSourcedContentTable.market, market),
        eq(
          accommodationSourcedContentTable.content_schema_version,
          ACCOMMODATION_CONTENT_SCHEMA_VERSION,
        ),
      ),
    )
}

async function fetchFreshContent(
  db: AnyDrizzleDb,
  adapter: SourceAdapter,
  ctx: SourceAdapterContext,
  request: GetContentRequest,
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
      const validation = validateAccommodationContent(got.content)
      if (!validation.valid) {
        throw new Error(
          `accommodation getContent for ${request.entity_id} failed validation: ${validation.reason}`,
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
      const validation = validateAccommodationContent(got.content)
      if (!validation.valid) return
      await writeCacheRow(db, request, got)
    },
  ).catch(() => {
    // intentional swallow — see §3.4 SWR refresh contract
  })
}

async function writeCacheRow(
  db: AnyDrizzleDb,
  request: GetContentRequest,
  result: GetContentResult,
): Promise<void> {
  const market = request.market ?? ACCOMMODATION_CONTENT_MARKET_ANY
  const now = new Date()
  // Coerce JSON-string dates to Date — see products writeCacheRow.
  const sourceUpdatedAt = toDateOrNull(result.source_updated_at)
  const freshUntil =
    toDateOrNull(result.fresh_until) ?? new Date(now.getTime() + ACCOMMODATION_DEFAULT_TTL_MS)

  await db
    .insert(accommodationSourcedContentTable)
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
        accommodationSourcedContentTable.entity_id,
        accommodationSourcedContentTable.locale,
        accommodationSourcedContentTable.market,
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

async function finalizeFromCache(
  db: AnyDrizzleDb,
  entityId: string,
  best: NonNullable<ReturnType<typeof pickBestCachedLocale<SelectAccommodationSourcedContent>>>,
  servedStale: boolean,
  options: GetAccommodationContentOptions,
): Promise<ResolvedAccommodationContent> {
  const validation = validateAccommodationContent(best.candidate.payload)
  if (!validation.valid) {
    throw new Error(
      `accommodation cache row for ${entityId} (${best.candidate.locale}) failed validation: ${validation.reason}`,
    )
  }
  const overlays = await fetchOverlaysForEntity(db, "accommodations", entityId)
  const merged = mergeOverlaysIntoAccommodationContent(
    validation.content,
    overlays.map((o) => ({ field_path: o.field_path, value: o.value })),
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
  return {
    content: merged,
    resolution: {
      candidate: { locale: best.candidate.locale, payload: merged },
      served_locale: best.candidate.returned_locale,
      match_kind: best.match_kind,
    },
    source: "sourced-cache",
    served_stale: servedStale,
    synthesized: false,
    machine_translated: best.candidate.machine_translated,
  }
}

async function finalizeFresh(
  db: AnyDrizzleDb,
  entityId: string,
  fresh: GetContentResult,
  scope: AccommodationContentScope,
  options: GetAccommodationContentOptions,
): Promise<ResolvedAccommodationContent> {
  const cachedContent = accommodationContentSchema.parse(fresh.content)
  const overlays = await fetchOverlaysForEntity(db, "accommodations", entityId)
  const merged = mergeOverlaysIntoAccommodationContent(
    cachedContent,
    overlays.map((o) => ({ field_path: o.field_path, value: o.value })),
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
  return {
    content: merged,
    resolution: {
      candidate: { locale: scope.preferredLocales[0] ?? fresh.returned_locale, payload: merged },
      served_locale: fresh.returned_locale,
      match_kind: scope.preferredLocales[0] === fresh.returned_locale ? "exact" : "language_match",
    },
    source: "sourced-fresh",
    served_stale: false,
    synthesized: false,
    machine_translated: fresh.machine_translated ?? false,
  }
}

function wrapSynthesized(
  synthesized: SynthesizedAccommodationContent,
  scope: AccommodationContentScope,
  servedStale: boolean,
): ResolvedAccommodationContent {
  return {
    content: synthesized.content,
    resolution: {
      candidate: { locale: synthesized.served_locale, payload: synthesized.content },
      served_locale: synthesized.served_locale,
      match_kind: scope.preferredLocales[0] === synthesized.served_locale ? "exact" : "any",
    },
    source: "synthesized",
    served_stale: servedStale,
    synthesized: true,
    machine_translated: false,
  }
}

/** Drift event consumer for the accommodation content cache. Per §3.4.1. */
export const invalidateAccommodationContentOnDrift: InvalidateOnDrift = createInvalidateOnDrift(
  accommodationSourcedContentTable,
  { entityModule: "accommodations" },
)

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
