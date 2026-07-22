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
import { eq, or } from "drizzle-orm"

import { cruiseShipCatalogPolicy } from "./catalog-policy-ships.js"
import type { SourceRef } from "./adapters/index.js"
import { encodeSourceRef } from "./lib/key.js"
import { cruiseShips } from "./schema-cabins.js"
import { cruises, cruiseSailings } from "./schema-core.js"

export const CRUISE_SHIP_SUBJECT_MODULE = CATALOG_PRESENTATION_SUBJECT_MODULES.CRUISE_SHIPS

const cruiseShipRegistry = createFieldPolicyRegistry(cruiseShipCatalogPolicy)

export interface CruiseShipOverlayScope {
  locale: string
  audience: "staff" | "customer" | "partner" | "supplier" | typeof OVERLAY_DEFAULT_SCOPE
  market: string
}

export interface CruiseShipOverlayTarget {
  field_path: string
}

export interface WriteCruiseShipOverlayInput extends CruiseShipOverlayTarget {
  scope: CruiseShipOverlayScope
  value: unknown
  expected_version?: number | null
  origin: OverlayOrigin
  editorial_note?: string
}

export interface ClearCruiseShipOverlayInput extends CruiseShipOverlayTarget {
  scope: CruiseShipOverlayScope
  expected_version?: number | null
}

export interface CruiseShipSourceReferenceInput {
  sourceKind: string
  sourceRef: SourceRef | string
  sourceConnectionId?: string | null
  sourceProvider?: string | null
  projection: Record<string, unknown>
}

export async function resolveSourcedCruiseShipReference(
  db: AnyDrizzleDb,
  input: CruiseShipSourceReferenceInput,
) {
  const sourceRef =
    typeof input.sourceRef === "string" ? input.sourceRef : encodeSourceRef(input.sourceRef)
  return resolveSourcedPresentationSubject(db, {
    entityModule: CRUISE_SHIP_SUBJECT_MODULE,
    idPrefix: "cruise_ships",
    sourceKind: input.sourceKind,
    sourceConnectionId: input.sourceConnectionId,
    sourceProvider: input.sourceProvider,
    sourceRef,
    projection: input.projection,
  })
}

export async function readCruiseShipOverlayState(
  db: AnyDrizzleDb,
  shipId: string,
  scope: CruiseShipOverlayScope,
) {
  const source = await readCruiseShipSourceProjection(db, shipId)
  if (!source) return null
  const overlays = await fetchOverlaysForEntity(db, CRUISE_SHIP_SUBJECT_MODULE, shipId)
  const resolverScope = toResolverScope(scope, "staff")
  const effective = resolveOverlay(cruiseShipRegistry, source.projection, overlays, resolverScope)
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
    subject: { module: CRUISE_SHIP_SUBJECT_MODULE, id: shipId },
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

export async function readPublicCruiseShipProjection(
  db: AnyDrizzleDb,
  shipId: string,
  scope: CruiseShipOverlayScope,
) {
  const source = await readCruiseShipSourceProjection(db, shipId)
  if (!source) return null
  const overlays = await fetchOverlaysForEntity(db, CRUISE_SHIP_SUBJECT_MODULE, shipId)
  const effective = resolveOverlay(
    cruiseShipRegistry,
    source.projection,
    overlays,
    toResolverScope(scope, publicActor(scope)),
  )
  return {
    subject: { module: CRUISE_SHIP_SUBJECT_MODULE, id: shipId },
    locale: effectiveLocale(scope.locale, source.sourceLocale, source.projection, effective),
    content: Object.fromEntries(effective.values),
  }
}

export function createCruiseShipDocumentBuilder(db: AnyDrizzleDb): DocumentBuilder {
  return async (shipId: string, slice: IndexerSlice) => {
    const source = await readCruiseShipSourceProjection(db, shipId)
    if (!source) return null
    const overlays = await fetchOverlaysForEntity(db, CRUISE_SHIP_SUBJECT_MODULE, shipId)
    const effective = resolveOverlay(
      cruiseShipRegistry,
      source.projection,
      overlays,
      resolverScopeForSlice(slice),
    )
    return buildIndexerDocument(cruiseShipRegistry, effective.values, slice, shipId)
  }
}

export async function writeCruiseShipOverlay(
  db: AnyDrizzleDb,
  shipId: string,
  input: WriteCruiseShipOverlayInput,
): Promise<SelectCatalogOverlay> {
  assertOverlayableShipField(input.field_path)
  const source = await readCruiseShipSourceProjection(db, shipId)
  if (!source) throw new Error(`Cruise ship ${shipId} not found`)
  return writeOverlay(db, {
    entity_module: CRUISE_SHIP_SUBJECT_MODULE,
    entity_id: shipId,
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

export async function clearCruiseShipOverlay(
  db: AnyDrizzleDb,
  shipId: string,
  input: ClearCruiseShipOverlayInput,
): Promise<SelectCatalogOverlay | null> {
  assertOverlayableShipField(input.field_path)
  return clearOverlayByTarget(db, {
    entity_module: CRUISE_SHIP_SUBJECT_MODULE,
    entity_id: shipId,
    node_kind: OVERLAY_ROOT_NODE_KIND,
    node_key: OVERLAY_ROOT_NODE_KEY,
    field_path: input.field_path,
    locale: input.scope.locale,
    audience: input.scope.audience,
    market: input.scope.market,
    expected_version: input.expected_version,
  })
}

export function listCruiseShipOverlayHistory(
  db: AnyDrizzleDb,
  shipId: string,
  target: Partial<CruiseShipOverlayTarget & CruiseShipOverlayScope> = {},
): Promise<SelectCatalogOverlayHistory[]> {
  return listOverlayHistoryForTarget(db, {
    entity_module: CRUISE_SHIP_SUBJECT_MODULE,
    entity_id: shipId,
    ...(target.field_path ? { field_path: target.field_path } : {}),
    ...(target.locale ? { locale: target.locale } : {}),
    ...(target.audience ? { audience: target.audience } : {}),
    ...(target.market ? { market: target.market } : {}),
  })
}

export async function listCruisesReferencingShip(
  db: AnyDrizzleDb,
  shipId: string,
): Promise<Array<{ entityModule: "cruises"; entityId: string }>> {
  const rows = await db
    .select({ id: cruises.id })
    .from(cruises)
    .leftJoin(cruiseSailings, eq(cruiseSailings.cruiseId, cruises.id))
    .where(or(eq(cruises.defaultShipId, shipId), eq(cruiseSailings.shipId, shipId)))
  return unique(rows.map((row) => row.id)).map((entityId) => ({
    entityModule: "cruises" as const,
    entityId,
  }))
}

export function assertOverlayableShipField(fieldPath: string): void {
  const policy = cruiseShipRegistry.resolve(fieldPath)
  if (!policy || policy.class !== "merchandisable" || policy.merge === "source-only") {
    throw new Error(`Field ${fieldPath} is not an overlayable cruise ship presentation field`)
  }
}

async function readCruiseShipSourceProjection(db: AnyDrizzleDb, shipId: string) {
  const sourced = await readSourcedEntry(db, CRUISE_SHIP_SUBJECT_MODULE, shipId)
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

  const row = (await db.select().from(cruiseShips).where(eq(cruiseShips.id, shipId)).limit(1))[0]
  if (!row) return null
  return {
    projection: new Map<string, unknown>([
      ["id", row.id],
      ["source.kind", "owned"],
      ["name", row.name],
      ["description", row.description],
      ["gallery", row.gallery ?? []],
      ["amenities", row.amenities ?? {}],
      ["deckPlanUrl", row.deckPlanUrl],
      ["shipType", row.shipType],
      ["capacityGuests", row.capacityGuests],
      ["capacityCrew", row.capacityCrew],
      ["cabinCount", row.cabinCount],
      ["deckCount", row.deckCount],
      ["lengthMeters", row.lengthMeters],
      ["cruisingSpeedKnots", row.cruisingSpeedKnots],
      ["yearBuilt", row.yearBuilt],
      ["yearRefurbished", row.yearRefurbished],
      ["imo", row.imo],
      ["isActive", row.isActive],
    ]),
    sourceLocale: null,
    provenance: { source_kind: "owned" },
  }
}

function toResolverScope(scope: CruiseShipOverlayScope, actor: ResolverScope["actor"]): ResolverScope {
  return {
    locale: scope.locale,
    audience: scope.audience === OVERLAY_DEFAULT_SCOPE ? actor : scope.audience,
    market: scope.market,
    actor,
  }
}

function publicActor(scope: CruiseShipOverlayScope): ResolverScope["actor"] {
  if (scope.audience === "partner" || scope.audience === "supplier") return scope.audience
  return "customer"
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
  scope: CruiseShipOverlayScope,
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
