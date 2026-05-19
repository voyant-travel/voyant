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
  type ContentLocaleMatchKind,
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
import {
  facilities,
  facilityAddressProjections,
  facilityFeatures,
  properties,
} from "@voyantjs/facilities/schema"
import { and, asc, eq, inArray } from "drizzle-orm"

import {
  ACCOMMODATION_CONTENT_SCHEMA_VERSION,
  type AccommodationContent,
  accommodationContentSchema,
  mergeOverlaysIntoAccommodationContent,
  validateAccommodationContent,
} from "./content-shape.js"
import {
  mealPlans,
  ratePlanRoomTypes,
  ratePlans,
  roomTypeBedConfigs,
  roomTypes,
} from "./schema-inventory.js"
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
  source: "sourced-cache" | "sourced-fresh" | "synthesized" | "owned"
  served_stale: boolean
  synthesized: boolean
  machine_translated: boolean
}

export interface BuildOwnedAccommodationContentOptions {
  preferredLocales: ReadonlyArray<string>
}

export interface BuildOwnedAccommodationContentResult {
  content: AccommodationContent
  servedLocale: string
  matchKind: ContentLocaleMatchKind
}

export async function getAccommodationContent(
  db: AnyDrizzleDb,
  entityId: string,
  scope: AccommodationContentScope,
  options: GetAccommodationContentOptions,
): Promise<ResolvedAccommodationContent | null> {
  const sourcedEntry = await readSourcedEntry(db, "accommodations", entityId)
  if (!sourcedEntry) {
    const owned = await buildOwnedAccommodationContent(db, entityId, {
      preferredLocales: scope.preferredLocales,
    })
    if (!owned) return null
    const overlays = await fetchOverlaysForEntity(db, "accommodations", entityId)
    const merged = mergeOverlaysIntoAccommodationContent(
      owned.content,
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
        candidate: { locale: owned.servedLocale, payload: merged },
        served_locale: owned.servedLocale,
        match_kind: owned.matchKind,
      },
      source: "owned",
      served_stale: false,
      synthesized: false,
      machine_translated: false,
    }
  }

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

export async function buildOwnedAccommodationContent(
  db: AnyDrizzleDb,
  entityId: string,
  options: BuildOwnedAccommodationContentOptions,
): Promise<BuildOwnedAccommodationContentResult | null> {
  // biome-ignore lint/suspicious/noExplicitAny: AnyDrizzleDb widens drizzle's row inference.
  const roomRow: any = (
    await db.select().from(roomTypes).where(eq(roomTypes.id, entityId)).limit(1)
  )[0]
  if (!roomRow) return null

  // biome-ignore lint/suspicious/noExplicitAny: AnyDrizzleDb widens drizzle's row inference.
  const propertyRow: any = (
    await db.select().from(properties).where(eq(properties.id, roomRow.propertyId)).limit(1)
  )[0]
  if (!propertyRow) return null

  const ownedRows = await Promise.all([
    db.select().from(facilities).where(eq(facilities.id, propertyRow.facilityId)).limit(1),
    db
      .select()
      .from(facilityAddressProjections)
      .where(eq(facilityAddressProjections.facilityId, propertyRow.facilityId))
      .limit(1),
    db
      .select()
      .from(facilityFeatures)
      .where(eq(facilityFeatures.facilityId, propertyRow.facilityId))
      .orderBy(asc(facilityFeatures.sortOrder), asc(facilityFeatures.name)),
    db
      .select()
      .from(roomTypes)
      .where(and(eq(roomTypes.propertyId, propertyRow.id), eq(roomTypes.active, true)))
      .orderBy(asc(roomTypes.sortOrder), asc(roomTypes.name)),
    db
      .select()
      .from(mealPlans)
      .where(and(eq(mealPlans.propertyId, propertyRow.id), eq(mealPlans.active, true)))
      .orderBy(asc(mealPlans.sortOrder), asc(mealPlans.name)),
    db
      .select()
      .from(ratePlans)
      .where(and(eq(ratePlans.propertyId, propertyRow.id), eq(ratePlans.active, true)))
      .orderBy(asc(ratePlans.sortOrder), asc(ratePlans.name)),
  ])
  const facilityRows = ownedRows[0] as Array<typeof facilities.$inferSelect>
  const addressRows = ownedRows[1] as Array<typeof facilityAddressProjections.$inferSelect>
  const featureRows = ownedRows[2] as Array<typeof facilityFeatures.$inferSelect>
  const roomRows = ownedRows[3] as Array<typeof roomTypes.$inferSelect>
  const mealPlanRows = ownedRows[4] as Array<typeof mealPlans.$inferSelect>
  const ratePlanRows = ownedRows[5] as Array<typeof ratePlans.$inferSelect>

  const roomIds = roomRows.map((row: typeof roomTypes.$inferSelect) => row.id)
  const ratePlanIds = ratePlanRows.map((row: typeof ratePlans.$inferSelect) => row.id)
  const [bedRows, ratePlanRoomRows] = await Promise.all([
    roomIds.length > 0
      ? db
          .select()
          .from(roomTypeBedConfigs)
          .where(inArray(roomTypeBedConfigs.roomTypeId, roomIds))
          .orderBy(asc(roomTypeBedConfigs.isPrimary), asc(roomTypeBedConfigs.createdAt))
      : [],
    ratePlanIds.length > 0
      ? db
          .select()
          .from(ratePlanRoomTypes)
          .where(
            and(
              inArray(ratePlanRoomTypes.ratePlanId, ratePlanIds),
              eq(ratePlanRoomTypes.active, true),
            ),
          )
          .orderBy(asc(ratePlanRoomTypes.sortOrder), asc(ratePlanRoomTypes.createdAt))
      : [],
  ])

  const facilityRow = facilityRows[0] ?? null
  const addressRow = addressRows[0] ?? null
  const content = accommodationContentSchema.parse({
    hotel: {
      id: propertyRow.id,
      name: facilityRow?.name ?? roomRow.name,
      description: facilityRow?.description ?? roomRow.description ?? null,
      star_rating: normalizeStarRating(propertyRow.rating, propertyRow.ratingScale),
      hero_image_url: firstStringFromMetadata(roomRow.metadata, "images"),
      highlights: featureRows
        .filter((feature: typeof facilityFeatures.$inferSelect) => feature.highlighted)
        .map((feature: typeof facilityFeatures.$inferSelect) => feature.name),
      brand: propertyRow.brandName ?? propertyRow.groupName ?? null,
      country: addressRow?.country ?? null,
      city: addressRow?.city ?? null,
      address: addressRow?.fullText ?? addressRow?.address ?? addressRow?.line1 ?? null,
      postal_code: addressRow?.postalCode ?? null,
      latitude: addressRow?.latitude ?? null,
      longitude: addressRow?.longitude ?? null,
      check_in_time: propertyRow.checkInTime ?? null,
      check_out_time: propertyRow.checkOutTime ?? null,
    },
    room_types: roomRows.map((room: typeof roomTypes.$inferSelect) =>
      ownedRoomTypeToContent(room, bedRows),
    ),
    rate_plans: ratePlanRows.map((plan: typeof ratePlans.$inferSelect) =>
      ownedRatePlanToContent(plan, ratePlanRoomRows),
    ),
    meal_plans: mealPlanRows.map((plan: typeof mealPlans.$inferSelect) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description ?? null,
      basis: mealPlanBasis(plan),
      inclusions: mealPlanInclusions(plan),
    })),
    amenities: featureRows
      .filter((feature: typeof facilityFeatures.$inferSelect) => feature.category === "amenity")
      .map((feature: typeof facilityFeatures.$inferSelect) => ({
        id: feature.code ?? feature.id,
        category: feature.category,
        name: feature.name,
        description: feature.description ?? feature.valueText ?? null,
        is_free: undefined,
      })),
    policies: propertyRow.policyNotes
      ? [{ kind: "supplier_notes" as const, body: propertyRow.policyNotes }]
      : [],
  })

  const validation = validateAccommodationContent(content)
  if (!validation.valid) {
    throw new Error(
      `owned accommodation ${entityId} projection failed validation: ${validation.reason}`,
    )
  }

  return {
    content,
    servedLocale: options.preferredLocales[0] ?? "en-GB",
    matchKind: options.preferredLocales.length > 0 ? "exact" : "any",
  }
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

function ownedRoomTypeToContent(
  room: typeof roomTypes.$inferSelect,
  bedRows: ReadonlyArray<typeof roomTypeBedConfigs.$inferSelect>,
): AccommodationContent["room_types"][number] {
  const roomBeds = bedRows.filter((bed) => bed.roomTypeId === room.id)
  return {
    id: room.id,
    code: room.code ?? null,
    name: room.name,
    description: room.description ?? null,
    room_class: room.roomClass ?? null,
    view: stringFromMetadata(room.metadata, "view"),
    bedrooms: room.bedroomCount ?? null,
    beds: roomBeds.map((bed) =>
      bed.quantity > 1 ? `${bed.quantity} ${bed.bedType}` : bed.bedType,
    ),
    size_sqm: room.areaUnit === "sqm" ? room.areaValue : null,
    max_adults: room.maxAdults ?? null,
    max_children: room.maxChildren ?? null,
    max_occupancy: room.maxOccupancy ?? room.standardOccupancy ?? null,
    amenities: stringArrayFromMetadata(room.metadata, "amenities"),
    images: stringArrayFromMetadata(room.metadata, "images"),
  }
}

function ownedRatePlanToContent(
  plan: typeof ratePlans.$inferSelect,
  ratePlanRoomRows: ReadonlyArray<typeof ratePlanRoomTypes.$inferSelect>,
): AccommodationContent["rate_plans"][number] {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description ?? null,
    charge_frequency: contentChargeFrequency(plan.chargeFrequency),
    applies_to_room_type_ids: ratePlanRoomRows
      .filter((row) => row.ratePlanId === plan.id)
      .map((row) => row.roomTypeId),
    cancellation_policy: plan.cancellationPolicyId ?? null,
    inclusions: [],
  }
}

function contentChargeFrequency(
  value: typeof ratePlans.$inferSelect.chargeFrequency,
): "per_night" | "per_stay" {
  return value === "per_stay" || value === "per_person_per_stay" ? "per_stay" : "per_night"
}

function mealPlanBasis(plan: typeof mealPlans.$inferSelect): string {
  if (plan.includesBreakfast && plan.includesLunch && plan.includesDinner) return "full_board"
  if (plan.includesBreakfast && plan.includesDinner) return "half_board"
  if (plan.includesBreakfast) return "bed_breakfast"
  return "room_only"
}

function mealPlanInclusions(plan: typeof mealPlans.$inferSelect): string[] {
  const inclusions: string[] = []
  if (plan.includesBreakfast) inclusions.push("Breakfast")
  if (plan.includesLunch) inclusions.push("Lunch")
  if (plan.includesDinner) inclusions.push("Dinner")
  if (plan.includesDrinks) inclusions.push("Drinks")
  return inclusions
}

function normalizeStarRating(value: unknown, scale: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (typeof scale === "number" && Number.isFinite(scale) && scale > 0 && scale !== 5) {
    return Math.max(0, Math.min(5, (value / scale) * 5))
  }
  return Math.max(0, Math.min(5, value))
}

function firstStringFromMetadata(metadata: unknown, key: string): string | null {
  return stringArrayFromMetadata(metadata, key)[0] ?? null
}

function stringArrayFromMetadata(metadata: unknown, key: string): string[] {
  if (!metadata || typeof metadata !== "object") return []
  const value = (metadata as Record<string, unknown>)[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function stringFromMetadata(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" && value.length > 0 ? value : null
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
