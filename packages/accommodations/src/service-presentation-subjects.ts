import {
  CATALOG_PRESENTATION_SUBJECT_MODULES,
  buildIndexerDocument,
  clearOverlayByTarget,
  createSourcedPresentationSubjectIngestion,
  createFieldPolicyRegistry,
  fetchOverlaysForEntity,
  listOverlayHistoryForTarget,
  OVERLAY_DEFAULT_SCOPE,
  OVERLAY_ROOT_NODE_KEY,
  OVERLAY_ROOT_NODE_KIND,
  readSourcedEntry,
  resolveOverlay,
  type DocumentBuilder,
  type EffectiveReferencedSubjectProjection,
  type IndexerSlice,
  type OverlayOrigin,
  type ResolverScope,
  type SelectCatalogOverlay,
  type SelectCatalogOverlayHistory,
  writeOverlay,
} from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  facilities,
  facilityAddressProjections,
  facilityFeatures,
  properties,
} from "@voyant-travel/operations"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { accommodationPropertyCatalogPolicy } from "./catalog-policy-properties.js"
import type { AccommodationContent } from "./content-shape.js"
import { roomTypes } from "./schema-inventory.js"

export const ACCOMMODATION_PROPERTY_SUBJECT_MODULE =
  CATALOG_PRESENTATION_SUBJECT_MODULES.ACCOMMODATION_PROPERTIES

const propertyRegistry = createFieldPolicyRegistry(accommodationPropertyCatalogPolicy)
const ingestAccommodationPropertySubject = createSourcedPresentationSubjectIngestion({
  entityModule: ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
  idPrefix: "properties",
})

const nonemptyString = z.string().trim().min(1)
const nullableString = z.string().nullable()

/** Canonical field value contracts for the accommodation-property subject. */
export const accommodationPropertyOverlayValueSchemas = {
  name: nonemptyString,
  description: z.string(),
  hero_image_url: z.string().url(),
  gallery: z.array(z.string().url()),
  highlights: z.array(nonemptyString),
  amenities: z.array(nonemptyString),
} as const

/**
 * The effective property document is deliberately closed. Provider-specific
 * keys cannot leak into storefront responses or be persisted as overlays.
 */
export const accommodationPropertyProjectionSchema = z
  .object({
    id: nonemptyString,
    "source.kind": nonemptyString.optional(),
    "source.ref": nonemptyString.optional(),
    name: nullableString.optional(),
    description: nullableString.optional(),
    hero_image_url: nullableString.optional(),
    gallery: z.array(z.string().url()).optional(),
    highlights: z.array(nonemptyString).optional(),
    amenities: z.array(nonemptyString).optional(),
    star_rating: z.number().int().min(0).max(10).nullable().optional(),
    brand: nullableString.optional(),
    country: nullableString.optional(),
    city: nullableString.optional(),
    address: nullableString.optional(),
    postal_code: nullableString.optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    check_in_time: nullableString.optional(),
    check_out_time: nullableString.optional(),
  })
  .strict()

export const publicAccommodationPropertyProjectionSchema =
  accommodationPropertyProjectionSchema.omit({
    "source.kind": true,
    "source.ref": true,
  })

export interface AccommodationPropertyOverlayScope {
  locale: string
  audience: "staff" | "customer" | "partner" | "supplier" | typeof OVERLAY_DEFAULT_SCOPE
  market: string
}

export interface PublicAccommodationPropertyOverlayScope
  extends Omit<AccommodationPropertyOverlayScope, "audience"> {
  audience: "customer" | "partner"
}

export interface AccommodationPropertyOverlayTarget {
  field_path: string
}

export interface WriteAccommodationPropertyOverlayInput
  extends AccommodationPropertyOverlayTarget {
  scope: AccommodationPropertyOverlayScope
  value: unknown
  expected_version?: number | null
  origin: OverlayOrigin
  editorial_note?: string
}

export interface ClearAccommodationPropertyOverlayInput
  extends AccommodationPropertyOverlayTarget {
  scope: AccommodationPropertyOverlayScope
  expected_version?: number | null
}

export interface SourcedAccommodationPropertyReferenceInput {
  sourceKind: string
  sourceRef: string
  sourceConnectionId?: string | null
  sourceProvider?: string | null
  projection: Record<string, unknown>
}

export async function resolveSourcedAccommodationPropertyReference(
  db: AnyDrizzleDb,
  input: SourcedAccommodationPropertyReferenceInput,
) {
  return ingestAccommodationPropertySubject(db, {
    sourceKind: input.sourceKind,
    sourceConnectionId: input.sourceConnectionId,
    sourceProvider: input.sourceProvider,
    sourceRef: input.sourceRef,
    projection: input.projection,
  })
}

/**
 * DB-owning discovery normalizers can use this before persisting a provider
 * product/offer reference. The returned value is the durable Voyant property
 * subject id; persist it instead of the provider's external hotel/facility id.
 *
 * Source adapters themselves do not receive a DB handle, so the generic
 * discovery orchestrator still needs an explicit referenced-subject
 * normalization hook before this can be guaranteed for every provider.
 */
export async function resolveSourcedAccommodationPropertySubjectId(
  db: AnyDrizzleDb,
  input: SourcedAccommodationPropertyReferenceInput,
): Promise<string> {
  return (await resolveSourcedAccommodationPropertyReference(db, input)).entity_id
}

/**
 * Capture the referenced hotel identity while adapter content is being
 * refreshed. The hotel id, not the sellable room/offer id, is the upstream
 * identity for this referenced presentation subject.
 */
export async function refreshSourcedAccommodationPropertyReference(
  db: AnyDrizzleDb,
  input: {
    sourceKind: string
    sourceConnectionId?: string | null
    sourceProvider?: string | null
    returnedLocale: string
    content: AccommodationContent
  },
) {
  const sourceRef = input.content.hotel.id.trim()
  if (!sourceRef) throw new Error("Sourced accommodation content requires a non-empty hotel id")
  return resolveSourcedAccommodationPropertySubjectId(db, {
    sourceKind: input.sourceKind,
    sourceConnectionId: input.sourceConnectionId ?? null,
    sourceProvider: input.sourceProvider ?? null,
    sourceRef,
    projection: accommodationPropertyProjectionFromContent(
      input.content,
      input.returnedLocale,
    ),
  })
}

export function accommodationPropertyProjectionFromContent(
  content: AccommodationContent,
  returnedLocale: string,
): Record<string, unknown> {
  return {
    ...content.hotel,
    locale: returnedLocale,
    gallery: unique(content.room_types.flatMap((room) => room.images)),
    amenities: unique(content.amenities.map((amenity) => amenity.name)),
  }
}

export async function readAccommodationPropertyOverlayState(
  db: AnyDrizzleDb,
  propertyId: string,
  scope: AccommodationPropertyOverlayScope,
) {
  const source = await readAccommodationPropertySourceProjection(db, propertyId)
  if (!source) return null
  const overlays = await fetchOverlaysForEntity(
    db,
    ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
    propertyId,
  )
  const effective = resolveOverlay(
    propertyRegistry,
    source.projection,
    overlays,
    toResolverScope(scope, "staff"),
  )
  const active = overlays.filter((overlay) => overlayMatchesScope(overlay, scope))
  const fields: Record<string, unknown> = {}
  for (const overlay of active) {
    fields[overlay.field_path] = {
      state: source.projection.has(overlay.field_path) ? "overlaid" : "overlay-only",
      sourceValue: source.projection.get(overlay.field_path) ?? null,
      overlayValue: overlay.value,
      effectiveValue: effective.values.get(overlay.field_path) ?? null,
      drifted: false,
      version: overlay.version ?? null,
      id: overlay.id ?? null,
      nodeKind: overlay.node_kind ?? OVERLAY_ROOT_NODE_KIND,
      nodeKey: overlay.node_key ?? OVERLAY_ROOT_NODE_KEY,
      fieldPath: overlay.field_path,
    }
  }
  return {
    subject: { module: ACCOMMODATION_PROPERTY_SUBJECT_MODULE, id: propertyId },
    locale: effectiveAccommodationPropertyLocale(
      scope.locale,
      source.sourceLocale,
      source.projection,
      effective,
    ),
    source: Object.fromEntries(source.projection),
    effective: Object.fromEntries(effective.values),
    fields,
    overlays: active,
    availableSourceLocales: source.sourceLocale ? [source.sourceLocale] : [],
    availableOverlayLocales: unique(overlays.map((overlay) => overlay.locale)),
    provenance: source.provenance,
  }
}

export async function readPublicAccommodationPropertyProjection(
  db: AnyDrizzleDb,
  propertyId: string,
  scope: PublicAccommodationPropertyOverlayScope,
) {
  const source = await readAccommodationPropertySourceProjection(db, propertyId)
  if (!source) return null
  const overlays = await fetchOverlaysForEntity(
    db,
    ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
    propertyId,
  )
  const effective = resolveOverlay(
    propertyRegistry,
    source.projection,
    overlays,
    toResolverScope(scope, publicActor(scope)),
  )
  return {
    subject: { module: ACCOMMODATION_PROPERTY_SUBJECT_MODULE, id: propertyId },
    locale: effectiveAccommodationPropertyLocale(
      scope.locale,
      source.sourceLocale,
      source.projection,
      effective,
    ),
    content: publicAccommodationPropertyProjectionSchema.parse(
      Object.fromEntries(effective.values),
    ),
  }
}

export function createAccommodationPropertyDocumentBuilder(db: AnyDrizzleDb): DocumentBuilder {
  return async (propertyId: string, slice: IndexerSlice) => {
    const source = await readAccommodationPropertySourceProjection(db, propertyId)
    if (!source) return null
    const overlays = await fetchOverlaysForEntity(
      db,
      ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
      propertyId,
    )
    const effective = resolveOverlay(
      propertyRegistry,
      source.projection,
      overlays,
      resolverScopeForSlice(slice),
    )
    return buildIndexerDocument(propertyRegistry, effective.values, slice, propertyId)
  }
}

/** Accommodation-owned fallback when the shared context has no owned-subject loader. */
export async function readEffectiveAccommodationPropertyReferenceProjection(
  db: AnyDrizzleDb,
  propertyId: string,
  slice: IndexerSlice,
): Promise<EffectiveReferencedSubjectProjection | null> {
  const source = await readAccommodationPropertySourceProjection(db, propertyId)
  if (!source) return null
  const overlays = await fetchOverlaysForEntity(
    db,
    ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
    propertyId,
  )
  const scope = {
    locale: slice.locale,
    audience: slice.audience === "staff-admin" ? ("staff" as const) : slice.audience,
    market: slice.market,
  }
  return {
    subject: { entityModule: ACCOMMODATION_PROPERTY_SUBJECT_MODULE, entityId: propertyId },
    scope,
    values: resolveOverlay(
      propertyRegistry,
      source.projection,
      overlays,
      resolverScopeForSlice(slice),
    ).values,
  }
}

export async function writeAccommodationPropertyOverlay(
  db: AnyDrizzleDb,
  propertyId: string,
  input: WriteAccommodationPropertyOverlayInput,
): Promise<SelectCatalogOverlay> {
  const policy = assertOverlayableAccommodationPropertyField(input.field_path)
  assertAccommodationPropertyOverlayScope(policy.localized, input.scope.locale)
  const value = parseAccommodationPropertyOverlayValue(input.field_path, input.value)
  const source = await readAccommodationPropertySourceProjection(db, propertyId)
  if (!source) throw new Error(`Accommodation property ${propertyId} not found`)
  const overlays = await fetchOverlaysForEntity(
    db,
    ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
    propertyId,
  )
  validateEffectiveAccommodationPropertyProjection(source.projection, overlays, {
    ...input,
    value,
  })
  return writeOverlay(db, {
    entity_module: ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
    entity_id: propertyId,
    node_kind: OVERLAY_ROOT_NODE_KIND,
    node_key: OVERLAY_ROOT_NODE_KEY,
    field_path: input.field_path,
    locale: input.scope.locale,
    audience: input.scope.audience,
    market: input.scope.market,
    value,
    origin: input.origin,
    expected_version: input.expected_version,
    editorial_note: input.editorial_note,
  })
}

export async function clearAccommodationPropertyOverlay(
  db: AnyDrizzleDb,
  propertyId: string,
  input: ClearAccommodationPropertyOverlayInput,
): Promise<SelectCatalogOverlay | null> {
  const policy = assertOverlayableAccommodationPropertyField(input.field_path)
  assertAccommodationPropertyOverlayScope(policy.localized, input.scope.locale)
  return clearOverlayByTarget(db, {
    entity_module: ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
    entity_id: propertyId,
    node_kind: OVERLAY_ROOT_NODE_KIND,
    node_key: OVERLAY_ROOT_NODE_KEY,
    field_path: input.field_path,
    locale: input.scope.locale,
    audience: input.scope.audience,
    market: input.scope.market,
    expected_version: input.expected_version,
  })
}

export function listAccommodationPropertyOverlayHistory(
  db: AnyDrizzleDb,
  propertyId: string,
  target: Partial<AccommodationPropertyOverlayTarget & AccommodationPropertyOverlayScope> = {},
): Promise<SelectCatalogOverlayHistory[]> {
  return listOverlayHistoryForTarget(db, {
    entity_module: ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
    entity_id: propertyId,
    ...(target.field_path ? { field_path: target.field_path } : {}),
    ...(target.locale ? { locale: target.locale } : {}),
    ...(target.audience ? { audience: target.audience } : {}),
    ...(target.market ? { market: target.market } : {}),
  })
}

export async function listAccommodationOffersReferencingProperty(
  db: AnyDrizzleDb,
  propertyId: string,
): Promise<Array<{ entityModule: "accommodations"; entityId: string }>> {
  const rows = await db
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .where(eq(roomTypes.propertyId, propertyId))
  return unique(rows.map((row) => row.id)).map((entityId) => ({
    entityModule: "accommodations" as const,
    entityId,
  }))
}

export function assertOverlayableAccommodationPropertyField(fieldPath: string) {
  const policy = propertyRegistry.resolve(fieldPath)
  if (!policy || policy.class !== "merchandisable" || policy.merge === "source-only") {
    throw new Error(
      `Field ${fieldPath} is not an overlayable accommodation property presentation field`,
    )
  }
  return policy
}

export function parseAccommodationPropertyOverlayValue(fieldPath: string, value: unknown): unknown {
  const schema = accommodationPropertyOverlayValueSchemas[
    fieldPath as keyof typeof accommodationPropertyOverlayValueSchemas
  ]
  if (!schema) {
    throw new Error(`Field ${fieldPath} has no accommodation property value contract`)
  }
  return schema.parse(value)
}

export function assertAccommodationPropertyOverlayScope(
  localized: boolean,
  locale: string,
): void {
  if (localized && locale === OVERLAY_DEFAULT_SCOPE) {
    throw new Error("Localized accommodation property overlays require a real locale")
  }
  if (!localized && locale !== OVERLAY_DEFAULT_SCOPE) {
    throw new Error("Non-localized accommodation property overlays require locale=default")
  }
}

/** Convert the field policy's reindex granularity into event scope axes. */
export function accommodationPropertyOverlayInvalidationScope(
  fieldPath: string,
  scope: AccommodationPropertyOverlayScope,
): Pick<AccommodationPropertyOverlayScope, "locale" | "audience" | "market"> {
  const policy = assertOverlayableAccommodationPropertyField(fieldPath)
  if (policy.reindex === "entry-locale") {
    return scope
  }
  // `default` is the catalog projection runtime's wildcard. Entry-wide and
  // facet-affecting changes therefore fan out to every configured slice.
  return {
    locale: OVERLAY_DEFAULT_SCOPE,
    audience: OVERLAY_DEFAULT_SCOPE,
    market: OVERLAY_DEFAULT_SCOPE,
  }
}

export function projectEffectiveAccommodationPropertyReference(
  subject: EffectiveReferencedSubjectProjection,
): ReadonlyMap<string, unknown> {
  const projection = new Map<string, unknown>()
  copyReferencedValue(subject.values, "name", projection, "property.name")
  copyReferencedValue(subject.values, "description", projection, "property.description")
  copyReferencedValue(subject.values, "hero_image_url", projection, "property.heroImageUrl")
  copyReferencedValue(subject.values, "gallery", projection, "property.gallery")
  return projection
}

function copyReferencedValue(
  source: ReadonlyMap<string, unknown>,
  sourcePath: string,
  target: Map<string, unknown>,
  targetPath: string,
): void {
  if (source.has(sourcePath)) target.set(targetPath, source.get(sourcePath))
}

export function validateEffectiveAccommodationPropertyProjection(
  source: ReadonlyMap<string, unknown>,
  overlays: readonly SelectCatalogOverlay[],
  input: WriteAccommodationPropertyOverlayInput,
): void {
  const withoutCurrentTarget = overlays.filter(
    (overlay) =>
      !(
        (overlay.node_kind ?? OVERLAY_ROOT_NODE_KIND) === OVERLAY_ROOT_NODE_KIND &&
        (overlay.node_key ?? OVERLAY_ROOT_NODE_KEY) === OVERLAY_ROOT_NODE_KEY &&
        overlay.field_path === input.field_path &&
        overlay.locale === input.scope.locale &&
        overlay.audience === input.scope.audience &&
        overlay.market === input.scope.market
      ),
  )
  const effective = resolveOverlay(
    propertyRegistry,
    source,
    [
      ...withoutCurrentTarget,
      {
        field_path: input.field_path,
        node_kind: OVERLAY_ROOT_NODE_KIND,
        node_key: OVERLAY_ROOT_NODE_KEY,
        locale: input.scope.locale,
        audience: input.scope.audience,
        market: input.scope.market,
        value: input.value,
      },
    ],
    toResolverScope(input.scope, "staff"),
  )
  accommodationPropertyProjectionSchema.parse(Object.fromEntries(effective.values))
}

async function readAccommodationPropertySourceProjection(db: AnyDrizzleDb, propertyId: string) {
  const sourced = await readSourcedEntry(db, ACCOMMODATION_PROPERTY_SUBJECT_MODULE, propertyId)
  if (sourced) {
    return {
      projection: new Map<string, unknown>([
        ...Object.entries(sourced.projection),
        ["id", sourced.entity_id],
        ["source.kind", sourced.source_kind],
        ["source.ref", sourced.source_ref],
      ]),
      sourceLocale: stringOr(sourced.projection.locale, null),
      provenance: {
        source_kind: sourced.source_kind,
        source_provider: sourced.source_provider,
        source_connection_id: sourced.source_connection_id,
        source_ref: sourced.source_ref,
      },
    }
  }

  const propertyRow = (
    await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1)
  )[0]
  if (!propertyRow) return null
  const [facilityRow] = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, propertyRow.facilityId))
    .limit(1)
  const [addressRow] = await db
    .select()
    .from(facilityAddressProjections)
    .where(eq(facilityAddressProjections.facilityId, propertyRow.facilityId))
    .limit(1)
  const featureRows = await db
    .select()
    .from(facilityFeatures)
    .where(eq(facilityFeatures.facilityId, propertyRow.facilityId))

  return {
    projection: new Map<string, unknown>([
      ["id", propertyRow.id],
      ["source.kind", "owned"],
      ["name", facilityRow?.name ?? propertyRow.brandName ?? propertyRow.groupName],
      ["description", facilityRow?.description ?? null],
      ["hero_image_url", null],
      ["gallery", []],
      ["highlights", featureRows.filter((row) => row.highlighted).map((row) => row.name)],
      [
        "amenities",
        featureRows.filter((row) => row.category === "amenity").map((row) => row.name),
      ],
      ["star_rating", propertyRow.rating ?? null],
      ["brand", propertyRow.brandName ?? propertyRow.groupName ?? null],
      ["country", addressRow?.country ?? null],
      ["city", addressRow?.city ?? null],
      ["address", addressRow?.fullText ?? addressRow?.address ?? addressRow?.line1 ?? null],
      ["postal_code", addressRow?.postalCode ?? null],
      ["latitude", addressRow?.latitude ?? null],
      ["longitude", addressRow?.longitude ?? null],
      ["check_in_time", propertyRow.checkInTime ?? null],
      ["check_out_time", propertyRow.checkOutTime ?? null],
    ]),
    sourceLocale: null,
    provenance: { source_kind: "owned" },
  }
}

function publicActor(scope: PublicAccommodationPropertyOverlayScope): ResolverScope["actor"] {
  return scope.audience
}

function toResolverScope(
  scope: AccommodationPropertyOverlayScope,
  actor: ResolverScope["actor"],
): ResolverScope {
  return {
    locale: scope.locale,
    audience: scope.audience === OVERLAY_DEFAULT_SCOPE ? actor : scope.audience,
    market: scope.market,
    actor,
  }
}

function resolverScopeForSlice(slice: IndexerSlice): ResolverScope {
  const actor = slice.audience === "staff-admin" ? "staff" : publicAudience(slice.audience)
  return {
    locale: slice.locale,
    audience: actor,
    market: slice.market,
    actor,
  }
}

function publicAudience(audience: string): ResolverScope["actor"] {
  if (audience === "staff" || audience === "partner" || audience === "supplier") return audience
  return "customer"
}

function overlayMatchesScope(
  overlay: { locale: string; audience: string; market: string },
  scope: AccommodationPropertyOverlayScope,
): boolean {
  return (
    overlay.locale === scope.locale &&
    overlay.audience === scope.audience &&
    overlay.market === scope.market
  )
}

export function effectiveAccommodationPropertyLocale(
  requestedLocale: string,
  sourceLocale: string | null,
  source: ReadonlyMap<string, unknown>,
  effective: ReturnType<typeof resolveOverlay>,
): {
  requestedLocale: string
  sourceLocale: string | null
  servedLocale: string
  matchKind: "exact" | "mixed" | "overlay-only"
} {
  const hasOverlayOnly = [...effective.provenance.entries()].some(
    ([path, provenance]) =>
      provenance?.locale === requestedLocale &&
      propertyRegistry.resolve(path)?.localized === true &&
      !source.has(path),
  )
  const hasRequestedLocaleOverlay = [...effective.provenance.entries()].some(
    ([path, provenance]) =>
      provenance?.locale === requestedLocale && propertyRegistry.resolve(path)?.localized === true,
  )
  const overlayReplacesFallback =
    sourceLocale != null && sourceLocale !== requestedLocale && hasRequestedLocaleOverlay
  return {
    requestedLocale,
    sourceLocale,
    servedLocale:
      hasOverlayOnly || overlayReplacesFallback
        ? requestedLocale
        : (sourceLocale ?? requestedLocale),
    matchKind: hasOverlayOnly
      ? "overlay-only"
      : sourceLocale === requestedLocale
        ? "exact"
        : "mixed",
  }
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === "string" && value.length > 0 ? value : fallback
}
