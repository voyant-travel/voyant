import {
  CATALOG_PRESENTATION_SUBJECT_MODULES,
  buildIndexerDocument,
  clearOverlayByTarget,
  createFieldPolicyRegistry,
  fetchOverlaysForEntity,
  listOverlayHistoryForTarget,
  OVERLAY_DEFAULT_SCOPE,
  OVERLAY_ROOT_NODE_KEY,
  OVERLAY_ROOT_NODE_KIND,
  readSourcedEntry,
  resolveOverlay,
  resolveSourcedPresentationSubject,
  type DocumentBuilder,
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

import { accommodationPropertyCatalogPolicy } from "./catalog-policy-properties.js"
import { roomTypes } from "./schema-inventory.js"

export const ACCOMMODATION_PROPERTY_SUBJECT_MODULE =
  CATALOG_PRESENTATION_SUBJECT_MODULES.ACCOMMODATION_PROPERTIES

const propertyRegistry = createFieldPolicyRegistry(accommodationPropertyCatalogPolicy)

export interface AccommodationPropertyOverlayScope {
  locale: string
  audience: "staff" | "customer" | "partner" | "supplier" | typeof OVERLAY_DEFAULT_SCOPE
  market: string
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

export async function resolveSourcedAccommodationPropertyReference(
  db: AnyDrizzleDb,
  input: {
    sourceKind: string
    sourceRef: string
    sourceConnectionId?: string | null
    sourceProvider?: string | null
    projection: Record<string, unknown>
  },
) {
  return resolveSourcedPresentationSubject(db, {
    entityModule: ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
    idPrefix: "properties",
    sourceKind: input.sourceKind,
    sourceConnectionId: input.sourceConnectionId,
    sourceProvider: input.sourceProvider,
    sourceRef: input.sourceRef,
    projection: input.projection,
  })
}

export async function readAccommodationPropertyOverlayState(
  db: AnyDrizzleDb,
  propertyId: string,
  scope: AccommodationPropertyOverlayScope,
) {
  const source = await readAccommodationPropertySourceProjection(db, propertyId)
  if (!source) return null
  const overlays = await fetchOverlaysForEntity(db, ACCOMMODATION_PROPERTY_SUBJECT_MODULE, propertyId)
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
    locale: effectiveLocale(scope.locale, source.sourceLocale, source.projection, effective),
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
  scope: AccommodationPropertyOverlayScope,
) {
  const source = await readAccommodationPropertySourceProjection(db, propertyId)
  if (!source) return null
  const overlays = await fetchOverlaysForEntity(db, ACCOMMODATION_PROPERTY_SUBJECT_MODULE, propertyId)
  const effective = resolveOverlay(
    propertyRegistry,
    source.projection,
    overlays,
    toResolverScope(scope, publicActor(scope)),
  )
  return {
    subject: { module: ACCOMMODATION_PROPERTY_SUBJECT_MODULE, id: propertyId },
    locale: effectiveLocale(scope.locale, source.sourceLocale, source.projection, effective),
    content: Object.fromEntries(effective.values),
  }
}

export function createAccommodationPropertyDocumentBuilder(db: AnyDrizzleDb): DocumentBuilder {
  return async (propertyId: string, slice: IndexerSlice) => {
    const source = await readAccommodationPropertySourceProjection(db, propertyId)
    if (!source) return null
    const overlays = await fetchOverlaysForEntity(db, ACCOMMODATION_PROPERTY_SUBJECT_MODULE, propertyId)
    const effective = resolveOverlay(
      propertyRegistry,
      source.projection,
      overlays,
      resolverScopeForSlice(slice),
    )
    return buildIndexerDocument(propertyRegistry, effective.values, slice, propertyId)
  }
}

export async function writeAccommodationPropertyOverlay(
  db: AnyDrizzleDb,
  propertyId: string,
  input: WriteAccommodationPropertyOverlayInput,
): Promise<SelectCatalogOverlay> {
  assertOverlayableAccommodationPropertyField(input.field_path)
  const source = await readAccommodationPropertySourceProjection(db, propertyId)
  if (!source) throw new Error(`Accommodation property ${propertyId} not found`)
  return writeOverlay(db, {
    entity_module: ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
    entity_id: propertyId,
    node_kind: OVERLAY_ROOT_NODE_KIND,
    node_key: OVERLAY_ROOT_NODE_KEY,
    field_path: input.field_path,
    locale: input.scope.locale,
    audience: input.scope.audience,
    market: input.scope.market,
    value: input.value,
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
  assertOverlayableAccommodationPropertyField(input.field_path)
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

export function assertOverlayableAccommodationPropertyField(fieldPath: string): void {
  const policy = propertyRegistry.resolve(fieldPath)
  if (!policy || policy.class !== "merchandisable" || policy.merge === "source-only") {
    throw new Error(
      `Field ${fieldPath} is not an overlayable accommodation property presentation field`,
    )
  }
}

async function readAccommodationPropertySourceProjection(db: AnyDrizzleDb, propertyId: string) {
  const sourced = await readSourcedEntry(db, ACCOMMODATION_PROPERTY_SUBJECT_MODULE, propertyId)
  if (sourced) {
    return {
      projection: new Map<string, unknown>([
        ["id", sourced.entity_id],
        ["source.kind", sourced.source_kind],
        ["source.ref", sourced.source_ref],
        ...Object.entries(sourced.projection),
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

function publicActor(scope: AccommodationPropertyOverlayScope): ResolverScope["actor"] {
  if (scope.audience === "partner" || scope.audience === "supplier") return scope.audience
  return "customer"
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

function effectiveLocale(
  requestedLocale: string,
  sourceLocale: string | null,
  source: ReadonlyMap<string, unknown>,
  effective: ReturnType<typeof resolveOverlay>,
) {
  const hasOverlayOnly = [...effective.provenance.entries()].some(
    ([path, provenance]) => provenance && !source.has(path),
  )
  return {
    requestedLocale,
    sourceLocale,
    servedLocale: hasOverlayOnly ? requestedLocale : (sourceLocale ?? requestedLocale),
    matchKind:
      hasOverlayOnly ? "overlay-only" : sourceLocale === requestedLocale ? "exact" : "mixed",
  }
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === "string" && value.length > 0 ? value : fallback
}
