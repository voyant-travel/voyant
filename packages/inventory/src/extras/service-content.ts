/**
 * Extras content service — `getExtraContent` with locale-resolved
 * cache reads, SWR refresh, and synthesizer fallback.
 *
 * Mirrors `service-content.ts` in the products / cruises / accommodations
 * / charters packages but extras-shaped. The extras content aggregate
 * (§3.2 / §3.6) is `{ extra, options[], media[], policies[] }` — one
 * payload returned by a single getContent. Pricing stays out (volatile-
 * live, flows through `liveResolve`).
 *
 * Extras don't appear in the search index (per the vertical's catalog-
 * policy.ts), but sourced extras still need rich content for the
 * booking-flow's add-on selection UI. The cache layer covers exactly
 * that surface.
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
  EXTRAS_CONTENT_SCHEMA_VERSION,
  type ExtraContent,
  extraContentSchema,
  mergeOverlaysIntoExtraContent,
  validateExtraContent,
} from "./content-shape.js"
import {
  EXTRAS_CONTENT_MARKET_ANY,
  extrasSourcedContentTable,
  type SelectExtrasSourcedContent,
} from "./schema-sourced-content.js"
import {
  type SynthesizedExtraContent,
  synthesizeExtraContent,
} from "./service-content-synthesizer.js"

/** Extras cache TTL is 24h — same as products. */
const EXTRAS_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

export interface ExtraContentScope {
  preferredLocales: ReadonlyArray<string>
  market?: string
  currency?: string
  acceptMachineTranslated?: boolean
}

export interface GetExtraContentOptions {
  registry: SourceAdapterRegistry
  buildAdapterContext?: (adapter: SourceAdapter) => SourceAdapterContext
  onOverlayError?: (event: { field_path: string; reason: string }) => void
}

export interface ResolvedExtraContent {
  content: ExtraContent
  resolution: ContentLocaleResolution<{ locale: string; payload: ExtraContent }>
  source: "sourced-cache" | "sourced-fresh" | "synthesized"
  served_stale: boolean
  synthesized: boolean
  machine_translated: boolean
}

export async function getExtraContent(
  db: AnyDrizzleDb,
  entityId: string,
  scope: ExtraContentScope,
  options: GetExtraContentOptions,
): Promise<ResolvedExtraContent | null> {
  const sourcedEntry = await readSourcedEntry(db, "extras", entityId)
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
  const market = scope.market ?? EXTRAS_CONTENT_MARKET_ANY
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
        entity_module: "extras",
        entity_id: entityId,
        locale: scope.preferredLocales[0] ?? best.candidate.locale,
        market,
        currency: scope.currency,
      })
    }
    return finalizeFromCache(db, entityId, best, true, options)
  }

  if (!adapter?.getContent) {
    const overlays = await fetchOverlaysForEntity(db, "extras", entityId)
    const synthesized = synthesizeExtraContent(
      { locale: scope.preferredLocales[0] ?? "en-GB" },
      {
        provenance,
        overlays: overlays.map((o) => ({ field_path: o.field_path, value: o.value })),
      },
    )
    return wrapSynthesized(synthesized, scope, false)
  }

  const fresh = await fetchFreshContent(db, adapter, adapterCtx, {
    entity_module: "extras",
    entity_id: entityId,
    locale: scope.preferredLocales[0] ?? "en-GB",
    market,
    currency: scope.currency,
  })
  if (!fresh) {
    const overlays = await fetchOverlaysForEntity(db, "extras", entityId)
    const synthesized = synthesizeExtraContent(
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
): Promise<SelectExtrasSourcedContent[]> {
  return db
    .select()
    .from(extrasSourcedContentTable)
    .where(
      and(
        eq(extrasSourcedContentTable.entity_id, entityId),
        eq(extrasSourcedContentTable.market, market),
        eq(extrasSourcedContentTable.content_schema_version, EXTRAS_CONTENT_SCHEMA_VERSION),
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
      const validation = validateExtraContent(got.content)
      if (!validation.valid) {
        throw new Error(
          `extras getContent for ${request.entity_id} failed validation: ${validation.reason}`,
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
      const validation = validateExtraContent(got.content)
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
  const market = request.market ?? EXTRAS_CONTENT_MARKET_ANY
  const now = new Date()
  // Coerce JSON-string dates to Date — see products writeCacheRow.
  const sourceUpdatedAt = toDateOrNull(result.source_updated_at)
  const freshUntil =
    toDateOrNull(result.fresh_until) ?? new Date(now.getTime() + EXTRAS_DEFAULT_TTL_MS)

  await db
    .insert(extrasSourcedContentTable)
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
        extrasSourcedContentTable.entity_id,
        extrasSourcedContentTable.locale,
        extrasSourcedContentTable.market,
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
  best: NonNullable<ReturnType<typeof pickBestCachedLocale<SelectExtrasSourcedContent>>>,
  servedStale: boolean,
  options: GetExtraContentOptions,
): Promise<ResolvedExtraContent> {
  const validation = validateExtraContent(best.candidate.payload)
  if (!validation.valid) {
    throw new Error(
      `extras cache row for ${entityId} (${best.candidate.locale}) failed validation: ${validation.reason}`,
    )
  }
  const overlays = await fetchOverlaysForEntity(db, "extras", entityId)
  const merged = mergeOverlaysIntoExtraContent(
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
  scope: ExtraContentScope,
  options: GetExtraContentOptions,
): Promise<ResolvedExtraContent> {
  const cachedContent = extraContentSchema.parse(fresh.content)
  const overlays = await fetchOverlaysForEntity(db, "extras", entityId)
  const merged = mergeOverlaysIntoExtraContent(
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
  synthesized: SynthesizedExtraContent,
  scope: ExtraContentScope,
  servedStale: boolean,
): ResolvedExtraContent {
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

/** Drift event consumer for the extras content cache. Per §3.4.1. */
export const invalidateExtraContentOnDrift: InvalidateOnDrift = createInvalidateOnDrift(
  extrasSourcedContentTable,
  { entityModule: "extras" },
)

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
