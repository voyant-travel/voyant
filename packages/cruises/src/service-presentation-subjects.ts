import {
  CATALOG_PRESENTATION_SUBJECT_MODULES,
  buildIndexerDocument,
  catalogSourcedEntriesTable,
  clearOverlayByTarget,
  createSourcedPresentationSubjectIngestion,
  createFieldPolicyRegistry,
  fetchOverlaysForEntity,
  listOverlayHistoryForTarget,
  OVERLAY_DEFAULT_SCOPE,
  OVERLAY_ROOT_NODE_KEY,
  OVERLAY_ROOT_NODE_KIND,
  readSourcedEntry,
  readSourcedEntryBySource,
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
import { and, eq, or } from "drizzle-orm"

import { cruiseShipCatalogPolicy } from "./catalog-policy-ships.js"
import type { ExternalShip, SourceRef } from "./adapters/index.js"
import { decodeSourceRef, encodeSourceRef } from "./lib/key.js"
import { cruiseShips } from "./schema-cabins.js"
import { cruises, cruiseSailings } from "./schema-core.js"
import { cruisesSourcedContentTable } from "./schema-sourced-content.js"
import { z } from "./validation-shared.js"

export const CRUISE_SHIP_SUBJECT_MODULE = CATALOG_PRESENTATION_SUBJECT_MODULES.CRUISE_SHIPS

const cruiseShipRegistry = createFieldPolicyRegistry(cruiseShipCatalogPolicy)
const ingestSourcedCruiseShip = createSourcedPresentationSubjectIngestion({
  entityModule: CRUISE_SHIP_SUBJECT_MODULE,
  idPrefix: "cruise_ships",
})

const shipOverlayValueSchemas = {
  name: z.string().trim().min(1).max(255),
  description: z.string().nullable(),
  gallery: z.array(z.string().min(1)),
  amenities: z.record(z.string(), z.unknown()),
  deckPlanUrl: z.string().url().nullable(),
} as const

const cruiseShipPresentationSchema = z
  .object({
    id: z.string().min(1),
    "source.kind": z.string().min(1).optional(),
    "source.ref": z.string().min(1).nullable().optional(),
    name: shipOverlayValueSchemas.name,
    description: shipOverlayValueSchemas.description.optional(),
    gallery: shipOverlayValueSchemas.gallery.optional(),
    amenities: shipOverlayValueSchemas.amenities.optional(),
    deckPlanUrl: shipOverlayValueSchemas.deckPlanUrl.optional(),
    shipType: z.string().min(1),
    capacityGuests: z.number().int().nonnegative().nullable().optional(),
    capacityCrew: z.number().int().nonnegative().nullable().optional(),
    cabinCount: z.number().int().nonnegative().nullable().optional(),
    deckCount: z.number().int().nonnegative().nullable().optional(),
    lengthMeters: z.string().nullable().optional(),
    cruisingSpeedKnots: z.string().nullable().optional(),
    yearBuilt: z.number().int().nonnegative().nullable().optional(),
    yearRefurbished: z.number().int().nonnegative().nullable().optional(),
    imo: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

export interface CruiseShipOverlayScope {
  locale: string
  audience: "staff" | "customer" | "partner" | "supplier" | typeof OVERLAY_DEFAULT_SCOPE
  market: string
}

export interface CruiseShipOverlayTarget {
  field_path: string
}

export type PublicCruiseShipOverlayScope = Omit<CruiseShipOverlayScope, "audience"> & {
  audience: "customer" | "partner"
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

export function externalCruiseShipToProjection(ship: ExternalShip): Record<string, unknown> {
  return {
    id: encodeSourceRef(ship.sourceRef),
    name: ship.name,
    description: ship.description ?? null,
    gallery: ship.gallery ?? [],
    amenities: ship.amenities ?? {},
    deckPlanUrl: ship.deckPlanUrl ?? null,
    shipType: ship.shipType,
    capacityGuests: ship.capacityGuests ?? null,
    capacityCrew: ship.capacityCrew ?? null,
    cabinCount: ship.cabinCount ?? null,
    deckCount: ship.deckCount ?? null,
    lengthMeters: ship.lengthMeters ?? null,
    cruisingSpeedKnots: ship.cruisingSpeedKnots ?? null,
    yearBuilt: ship.yearBuilt ?? null,
    yearRefurbished: ship.yearRefurbished ?? null,
    imo: ship.imo ?? null,
    isActive: true,
  }
}

export function ingestExternalCruiseShip(
  db: AnyDrizzleDb,
  sourceProvider: string,
  ship: ExternalShip,
) {
  return resolveSourcedCruiseShipReference(db, {
    sourceKind: `cruise:${sourceProvider}`,
    sourceProvider,
    sourceConnectionId: ship.sourceRef.connectionId ?? null,
    sourceRef: ship.sourceRef,
    projection: externalCruiseShipToProjection(ship),
  })
}

/**
 * Resolve an already-ingested provider ship without mutating catalog state.
 * Public GET routes use this lookup so storefront reads never become an
 * implicit discovery/write boundary.
 */
export function findExistingExternalCruiseShipSubject(
  db: AnyDrizzleDb,
  sourceProvider: string,
  ship: ExternalShip,
) {
  return readSourcedEntryBySource(db, {
    entityModule: CRUISE_SHIP_SUBJECT_MODULE,
    sourceKind: `cruise:${sourceProvider}`,
    sourceConnectionId: ship.sourceRef.connectionId ?? null,
    sourceRef: encodeSourceRef(ship.sourceRef),
  })
}

export async function resolveSourcedCruiseShipReference(
  db: AnyDrizzleDb,
  input: CruiseShipSourceReferenceInput,
) {
  const sourceRef =
    typeof input.sourceRef === "string" ? input.sourceRef : encodeSourceRef(input.sourceRef)
  return ingestSourcedCruiseShip(db, {
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
    locale: resolveCruiseShipEffectiveLocale(
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

export async function readPublicCruiseShipProjection(
  db: AnyDrizzleDb,
  shipId: string,
  scope: PublicCruiseShipOverlayScope,
) {
  const source = await readCruiseShipSourceProjection(db, shipId)
  if (!source) return null
  const overlays = await fetchOverlaysForEntity(db, CRUISE_SHIP_SUBJECT_MODULE, shipId)
  const effective = resolveOverlay(
    cruiseShipRegistry,
    source.projection,
    overlays,
    toResolverScope(scope, scope.audience),
  )
  const content = Object.fromEntries(effective.values)
  delete content["source.kind"]
  delete content["source.ref"]
  return {
    subject: { module: CRUISE_SHIP_SUBJECT_MODULE, id: shipId },
    locale: resolveCruiseShipEffectiveLocale(
      scope.locale,
      source.sourceLocale,
      source.projection,
      effective,
    ),
    content,
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

/** Cruise-owned fallback for builders whose canonical context has no owned-subject loader. */
export async function readEffectiveCruiseShipReferenceProjection(
  db: AnyDrizzleDb,
  shipId: string,
  slice: IndexerSlice,
): Promise<EffectiveReferencedSubjectProjection | null> {
  const source = await readCruiseShipSourceProjection(db, shipId)
  if (!source) return null
  const overlays = await fetchOverlaysForEntity(db, CRUISE_SHIP_SUBJECT_MODULE, shipId)
  const scope = {
    locale: slice.locale,
    audience: slice.audience === "staff-admin" ? ("staff" as const) : slice.audience,
    market: slice.market,
  }
  return {
    subject: { entityModule: CRUISE_SHIP_SUBJECT_MODULE, entityId: shipId },
    scope,
    values: resolveOverlay(
      cruiseShipRegistry,
      source.projection,
      overlays,
      resolverScopeForSlice(slice),
    ).values,
  }
}

export async function writeCruiseShipOverlay(
  db: AnyDrizzleDb,
  shipId: string,
  input: WriteCruiseShipOverlayInput,
): Promise<SelectCatalogOverlay> {
  const scope = normalizeShipOverlayScope(input.field_path, input.scope)
  assertOverlayableShipValue(input.field_path, input.value)
  const source = await readCruiseShipSourceProjection(db, shipId)
  if (!source) throw new Error(`Cruise ship ${shipId} not found`)
  const overlays = await fetchOverlaysForEntity(db, CRUISE_SHIP_SUBJECT_MODULE, shipId)
  const candidate = [
    ...overlays.filter(
      (overlay) =>
        !(
          overlay.field_path === input.field_path &&
          overlay.locale === scope.locale &&
          overlay.audience === scope.audience &&
          overlay.market === scope.market
        ),
    ),
    {
      field_path: input.field_path,
      locale: scope.locale,
      audience: scope.audience,
      market: scope.market,
      value: input.value,
    },
  ]
  const merged = resolveOverlay(
    cruiseShipRegistry,
    source.projection,
    candidate,
    toResolverScope(scope, "staff"),
  )
  const validation = cruiseShipPresentationSchema.safeParse(Object.fromEntries(merged.values))
  if (!validation.success) {
    throw new Error(`Cruise ship editorial overlay failed validation: ${validation.error.message}`)
  }
  return writeOverlay(db, {
    entity_module: CRUISE_SHIP_SUBJECT_MODULE,
    entity_id: shipId,
    node_kind: OVERLAY_ROOT_NODE_KIND,
    node_key: OVERLAY_ROOT_NODE_KEY,
    field_path: input.field_path,
    locale: scope.locale,
    audience: scope.audience,
    market: scope.market,
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
  const scope = normalizeShipOverlayScope(input.field_path, input.scope)
  return clearOverlayByTarget(db, {
    entity_module: CRUISE_SHIP_SUBJECT_MODULE,
    entity_id: shipId,
    node_kind: OVERLAY_ROOT_NODE_KIND,
    node_key: OVERLAY_ROOT_NODE_KEY,
    field_path: input.field_path,
    locale: scope.locale,
    audience: scope.audience,
    market: scope.market,
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
  const ownedRows = await db
    .select({ id: cruises.id })
    .from(cruises)
    .leftJoin(cruiseSailings, eq(cruiseSailings.cruiseId, cruises.id))
    .where(or(eq(cruises.defaultShipId, shipId), eq(cruiseSailings.shipId, shipId)))
  const shipEntry = await readSourcedEntry(db, CRUISE_SHIP_SUBJECT_MODULE, shipId)
  const sourcedIds = shipEntry ? await listSourcedCruiseReferenceIds(db, shipEntry) : []
  return unique([...ownedRows.map((row) => row.id), ...sourcedIds]).map((entityId) => ({
    entityModule: "cruises" as const,
    entityId,
  }))
}

export async function findSourcedCruiseShipSubjectId(
  db: AnyDrizzleDb,
  cruiseEntry: NonNullable<Awaited<ReturnType<typeof readSourcedEntry>>> | null,
): Promise<string | null> {
  if (!cruiseEntry) return null
  let externalId = referencedShipExternalId(cruiseEntry.projection)
  if (!externalId) {
    const cachedRows = await db
      .select({ payload: cruisesSourcedContentTable.payload })
      .from(cruisesSourcedContentTable)
      .where(eq(cruisesSourcedContentTable.entity_id, cruiseEntry.entity_id))
    externalId = cachedRows
      .map((row) => referencedShipExternalId(row.payload))
      .find((value): value is string => value !== null) ?? null
  }
  if (!externalId) return null
  const candidates = await db
    .select({
      entityId: catalogSourcedEntriesTable.entity_id,
      sourceRef: catalogSourcedEntriesTable.source_ref,
      sourceConnectionId: catalogSourcedEntriesTable.source_connection_id,
    })
    .from(catalogSourcedEntriesTable)
    .where(
      and(
        eq(catalogSourcedEntriesTable.entity_module, CRUISE_SHIP_SUBJECT_MODULE),
        eq(catalogSourcedEntriesTable.source_kind, cruiseEntry.source_kind),
      ),
    )
  return (
    candidates.find(
      (candidate) =>
        (candidate.sourceConnectionId === cruiseEntry.source_connection_id ||
          candidate.sourceConnectionId === null) &&
        decodeSourceRef(candidate.sourceRef ?? "")?.externalId === externalId,
    )?.entityId ?? null
  )
}

export function assertOverlayableShipField(fieldPath: string) {
  const policy = cruiseShipRegistry.resolve(fieldPath)
  if (!policy || policy.class !== "merchandisable" || policy.merge === "source-only") {
    throw new Error(`Field ${fieldPath} is not an overlayable cruise ship presentation field`)
  }
  return policy
}

export function assertOverlayableShipValue(fieldPath: string, value: unknown): void {
  assertOverlayableShipField(fieldPath)
  const schema = shipOverlayValueSchemas[fieldPath as keyof typeof shipOverlayValueSchemas]
  if (!schema) throw new Error(`Field ${fieldPath} has no cruise ship overlay value schema`)
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`Invalid cruise ship ${fieldPath} overlay value: ${parsed.error.message}`)
  }
}

export function projectEffectiveCruiseShipReference(
  subject: EffectiveReferencedSubjectProjection,
): ReadonlyMap<string, unknown> {
  const projection = new Map<string, unknown>()
  copyReferencedValue(subject.values, "name", projection, "ship.name")
  copyReferencedValue(subject.values, "description", projection, "ship.description")
  const gallery = subject.values.get("gallery")
  if (Array.isArray(gallery)) projection.set("ship.heroImageUrl", gallery[0] ?? null)
  copyReferencedValue(subject.values, "gallery", projection, "ship.gallery")
  copyReferencedValue(subject.values, "deckPlanUrl", projection, "ship.deckPlanUrl")
  return projection
}

/** Convert field-policy reindex granularity into catalog wildcard axes. */
export function cruiseShipOverlayInvalidationScope(
  fieldPath: string,
  scope: CruiseShipOverlayScope,
): Pick<CruiseShipOverlayScope, "locale" | "audience" | "market"> {
  const policy = assertOverlayableShipField(fieldPath)
  if (policy.reindex === "entry-locale") return scope
  return {
    locale: OVERLAY_DEFAULT_SCOPE,
    audience: OVERLAY_DEFAULT_SCOPE,
    market: OVERLAY_DEFAULT_SCOPE,
  }
}

function copyReferencedValue(
  source: ReadonlyMap<string, unknown>,
  sourcePath: string,
  target: Map<string, unknown>,
  targetPath: string,
): void {
  if (source.has(sourcePath)) target.set(targetPath, source.get(sourcePath))
}

async function readCruiseShipSourceProjection(db: AnyDrizzleDb, shipId: string) {
  const sourced = await readSourcedEntry(db, CRUISE_SHIP_SUBJECT_MODULE, shipId)
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

export function resolveCruiseShipEffectiveLocale(
  requestedLocale: string,
  sourceLocale: string | null,
  source: ReadonlyMap<string, unknown>,
  effective: ReturnType<typeof resolveOverlay>,
) {
  const requestedOverlayPaths = [...effective.provenance.entries()].filter(
    ([, provenance]) => provenance?.locale === requestedLocale,
  )
  const hasRequestedOverlay = requestedOverlayPaths.length > 0
  const hasOverlayOnly = requestedOverlayPaths.some(([path]) => !source.has(path))
  const sourceIsExact = sourceLocale === requestedLocale
  return {
    requestedLocale,
    sourceLocale,
    servedLocale: hasRequestedOverlay ? requestedLocale : (sourceLocale ?? requestedLocale),
    matchKind:
      hasRequestedOverlay && !sourceIsExact
        ? "fallback_chain"
        : hasOverlayOnly
          ? "overlay_only"
          : sourceIsExact
            ? "exact"
            : "source_fallback",
  }
}

function normalizeShipOverlayScope(
  fieldPath: string,
  scope: CruiseShipOverlayScope,
): CruiseShipOverlayScope {
  assertOverlayableShipField(fieldPath)
  const policy = cruiseShipRegistry.resolve(fieldPath)
  if (!policy) throw new Error(`Missing cruise ship field policy for ${fieldPath}`)
  const locale = normalizeNonEmpty(scope.locale, "locale")
  if (policy.localized && locale === OVERLAY_DEFAULT_SCOPE) {
    throw new Error(`Localized cruise ship field ${fieldPath} requires a real locale`)
  }
  if (!policy.localized && locale !== OVERLAY_DEFAULT_SCOPE) {
    throw new Error(
      `Nonlocalized cruise ship field ${fieldPath} must use locale=${OVERLAY_DEFAULT_SCOPE}`,
    )
  }
  return {
    locale,
    audience: scope.audience,
    market: normalizeNonEmpty(scope.market, "market"),
  }
}

async function listSourcedCruiseReferenceIds(
  db: AnyDrizzleDb,
  shipEntry: NonNullable<Awaited<ReturnType<typeof readSourcedEntry>>>,
): Promise<string[]> {
  const shipExternalId = decodeSourceRef(shipEntry.source_ref ?? "")?.externalId
  if (!shipExternalId) return []
  const sourceRows = await db
    .select({
      entityId: catalogSourcedEntriesTable.entity_id,
      sourceConnectionId: catalogSourcedEntriesTable.source_connection_id,
      projection: catalogSourcedEntriesTable.projection,
    })
    .from(catalogSourcedEntriesTable)
    .where(
      and(
        eq(catalogSourcedEntriesTable.entity_module, "cruises"),
        eq(catalogSourcedEntriesTable.source_kind, shipEntry.source_kind),
      ),
    )
  const sameSource = sourceRows.filter(
    (row) =>
      shipEntry.source_connection_id === null ||
      row.sourceConnectionId === shipEntry.source_connection_id,
  )
  const direct = sameSource
    .filter((row) =>
      projectionReferencesCruiseShip(
        row.projection,
        shipIdCandidates(shipEntry.entity_id, shipExternalId, shipEntry.source_ref),
      ),
    )
    .map((row) => row.entityId)

  const cachedRows = await db
    .select({
      entityId: cruisesSourcedContentTable.entity_id,
      payload: cruisesSourcedContentTable.payload,
    })
    .from(cruisesSourcedContentTable)
  const sameSourceIds = new Set(sameSource.map((row) => row.entityId))
  const cached = cachedRows
    .filter(
      (row) =>
        sameSourceIds.has(row.entityId) &&
        projectionReferencesCruiseShip(
          row.payload,
          shipIdCandidates(shipEntry.entity_id, shipExternalId, shipEntry.source_ref),
        ),
    )
    .map((row) => row.entityId)
  return unique([...direct, ...cached])
}

function shipIdCandidates(
  shipId: string,
  externalId: string,
  encodedSourceRef: string | null,
): ReadonlySet<string> {
  return new Set([
    shipId,
    externalId,
    ...(encodedSourceRef ? [`crus_${encodedSourceRef}`] : []),
  ])
}

export function projectionReferencesCruiseShip(
  projection: Record<string, unknown>,
  candidates: ReadonlySet<string>,
): boolean {
  const direct = [
    projection.defaultShipId,
    projection.default_ship_id,
    projection.shipExternalId,
    projection.ship_external_id,
  ]
  if (direct.some((value) => typeof value === "string" && candidates.has(value))) return true
  const ship = asRecord(projection.ship)
  if (ship && typeof ship.id === "string" && candidates.has(ship.id)) return true
  const ref = asRecord(projection.defaultShipRef ?? projection.default_ship_ref)
  return !!ref && typeof ref.externalId === "string" && candidates.has(ref.externalId)
}

function referencedShipExternalId(projection: Record<string, unknown>): string | null {
  const direct = [
    projection.defaultShipId,
    projection.default_ship_id,
    projection.shipExternalId,
    projection.ship_external_id,
  ].find((value): value is string => typeof value === "string" && value.length > 0)
  if (direct) return normalizeExternalShipId(direct)
  const ship = asRecord(projection.ship)
  if (ship && typeof ship.id === "string" && ship.id.length > 0) {
    return normalizeExternalShipId(ship.id)
  }
  const ref = asRecord(projection.defaultShipRef ?? projection.default_ship_ref)
  return ref && typeof ref.externalId === "string" ? ref.externalId : null
}

function normalizeExternalShipId(value: string): string {
  const encoded = value.startsWith("crus_") ? value.slice("crus_".length) : value
  return decodeSourceRef(encoded)?.externalId ?? value
}

function normalizeNonEmpty(value: string, field: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${field} must be nonempty`)
  return trimmed
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === "string" && value.length > 0 ? value : fallback
}
