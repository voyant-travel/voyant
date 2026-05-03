/**
 * Adapt a vertical-shaped `CruiseAdapter` (with its multi-method
 * `fetchCruise / fetchSailing / fetchShip / fetchSailingItinerary`
 * surface) into a catalog-plane `SourceAdapter` so the cruises module
 * can participate in:
 *
 *   - The catalog plane's discovery / projection-capture pipeline
 *     (`sync.ts` writes a `catalog_sourced_entries` row per emitted
 *     projection), enabling the durable thin-content synthesizer
 *     fallback for cruises (sourced-content §2.5, §3.6).
 *   - The `getCruiseContent` SWR machinery (sourced-content §3.4) —
 *     the shim's `getContent` composes the cruise adapter's per-aspect
 *     fetches into one `CruiseContent` payload.
 *   - The catalog plane's snapshot content capture (sourced-content
 *     §5.1) — `bookEntity` calls this `getContent` at commit time.
 *
 * Per the doc's Phase E note: the cruise adapter retains its internal
 * multi-call composition; only the public catalog surface narrows.
 *
 * Templates wire the shim by registering it into the catalog
 * `SourceAdapterRegistry` AT PROCESS START, alongside the cruise
 * adapter's own per-vertical registration. Both registrations are
 * cheap — they share the same underlying `CruiseAdapter` instance.
 */

import type {
  AdapterCapabilities,
  CancelRequest,
  CancelResult,
  CatalogProjection,
  ConnectionState,
  DiscoveryCursor,
  DiscoveryPage,
  GetContentRequest,
  GetContentResult,
  LiveResolveRequest,
  LiveResolveResult,
  ReserveRequest,
  ReserveResult,
  SourceAdapter,
  SourceAdapterContext,
} from "@voyantjs/catalog"
import type { Provenance } from "@voyantjs/catalog/provenance"

import { CRUISES_CONTENT_SCHEMA_VERSION, type CruiseContent } from "../content-shape.js"

import type {
  CruiseAdapter,
  CruiseSearchProjectionEntry,
  ExternalCabinCategory,
  ExternalCruise,
  ExternalItineraryDay,
  ExternalSailing,
  ExternalShip,
  SourceRef,
} from "./index.js"

export interface CruiseSourceAdapterShimOptions {
  /**
   * The `source_kind` reported on every projection emitted by the
   * shim. Defaults to `"cruise:" + adapter.name` so multiple cruise
   * adapters (different agencies) coexist in the catalog registry
   * without colliding on `source_kind`.
   */
  sourceKind?: string
  /**
   * Optional translator from `SourceRef` → catalog-side `entity_id`.
   * Catalog `entity_id` is the Voyant-side TypeID; this shim produces
   * one synthetically by hashing the upstream ref so discovery is
   * idempotent. Templates can override when they have an external-id
   * → typeid mapping in their own DB.
   *
   * The default produces stable ids that round-trip across re-syncs:
   * `crus_${slug-of-externalId}`. The catalog plane uses the entity_id
   * as its primary key into `catalog_sourced_entries`, so stability is
   * load-bearing — drift on the id maps to a new entity.
   */
  buildEntityId?: (sourceRef: SourceRef) => string
  /**
   * Pagination batch size for `discover`. Defaults to 200 — large
   * enough to amortize HTTP overhead, small enough to cap memory.
   */
  pageSize?: number
  /**
   * BCP 47 locales the cruise adapter can serve content in. Reported
   * via `capabilities.supportedContentLocales`. Defaults to undefined
   * (unknown — caller probes per-call).
   */
  supportedContentLocales?: ReadonlyArray<string>
  /**
   * When false, declares `supportsContentFetch: false` so the catalog
   * plane skips `getContent` and falls through to the per-vertical
   * thin-content synthesizer (sourced-content §3.6). Defaults to
   * true — the shim composes a real `CruiseContent` payload from the
   * cruise adapter's per-aspect fetches.
   */
  supportsContentFetch?: boolean
}

export interface CruiseSourceAdapterShim extends SourceAdapter {
  /** The wrapped vertical adapter — exposed for diagnostics / tests. */
  readonly cruiseAdapter: CruiseAdapter
}

/**
 * Wrap a `CruiseAdapter` as a catalog `SourceAdapter`. The wrapped
 * adapter is shared by reference — its internal state (HTTP clients,
 * caches, credentials) is not duplicated.
 */
export function cruiseAdapterToSourceAdapter(
  cruiseAdapter: CruiseAdapter,
  options: CruiseSourceAdapterShimOptions = {},
): CruiseSourceAdapterShim {
  const sourceKind = options.sourceKind ?? `cruise:${cruiseAdapter.name}`
  const buildEntityId = options.buildEntityId ?? defaultBuildEntityId
  const pageSize = options.pageSize ?? 200
  const supportsContentFetch = options.supportsContentFetch ?? true

  const capabilities: AdapterCapabilities = {
    verticals: ["cruises"],
    supportsLiveResolution: true,
    supportsDriftDetection: false,
    supportsBookingForwarding: true,
    postBookOperations: ["cancel", "status"],
    supportsContentFetch,
    supportedContentLocales: options.supportedContentLocales,
  }

  return {
    cruiseAdapter,
    kind: sourceKind,
    capabilities,

    async connect(_ctx: SourceAdapterContext): Promise<void> {
      // CruiseAdapter has no explicit connect — the underlying HTTP
      // client is constructed at adapter creation time.
    },

    async pause(_ctx: SourceAdapterContext): Promise<void> {
      // No-op for the shim. Pause for cruise adapters typically means
      // "stop the polling loop", which is template-orchestrated.
    },

    async disconnect(_ctx: SourceAdapterContext): Promise<void> {
      // No-op. Templates revoke credentials at the cruise-adapter
      // layer, not via the catalog-plane shim.
    },

    async getState(_ctx: SourceAdapterContext): Promise<ConnectionState> {
      // CruiseAdapter doesn't surface state. Default to "active";
      // catalog-side disconnect detection happens through drift
      // events, not state polling.
      return "active"
    },

    async discover(_ctx: SourceAdapterContext, cursor?: DiscoveryCursor): Promise<DiscoveryPage> {
      // Use `searchProjection` (the cruise vertical's bulk-stream
      // surface) and translate each entry to a catalog
      // `CatalogProjection`. Cursor handling is opaque — the shim
      // walks the iterable up to `pageSize` items per page and
      // encodes a small JSON cursor with the offset.
      const offset = parseCursor(cursor)
      const projections: CatalogProjection[] = []
      let scanned = 0
      let nextCursor: DiscoveryCursor

      const iterator = cruiseAdapter.searchProjection({})[Symbol.asyncIterator]()
      // Skip past `offset` items so re-pagination is consistent.
      for (let i = 0; i < offset; i += 1) {
        const skip = await iterator.next()
        if (skip.done) {
          // Cursor advanced past end → return empty page.
          return { projections: [], next_cursor: undefined }
        }
      }

      while (scanned < pageSize) {
        const next = await iterator.next()
        if (next.done) break
        const entry = next.value as CruiseSearchProjectionEntry
        projections.push(toCatalogProjection(entry, sourceKind, buildEntityId))
        scanned += 1
      }

      const peek = await iterator.next()
      if (!peek.done) {
        nextCursor = encodeCursor(offset + scanned)
      }
      return { projections, next_cursor: nextCursor }
    },

    async liveResolve(
      _ctx: SourceAdapterContext,
      _request: LiveResolveRequest,
    ): Promise<LiveResolveResult> {
      // Cruise pricing flows through `fetchSailingPricing` per
      // sailing — but the catalog `LiveResolveRequest` is keyed by
      // entity_id (the cruise typeid), not by sailing. v1 leaves
      // this as an explicit not-supported: callers should use the
      // cruises module's per-sailing pricing routes directly. The
      // catalog plane's quote engine still works because cruises'
      // own quote path is exercised through the vertical's routes.
      return {
        values: {},
        failed: {
          /* nothing — empty result is the contract */
        },
      }
    },

    async getContent(
      _ctx: SourceAdapterContext,
      request: GetContentRequest,
    ): Promise<GetContentResult> {
      // Compose the cruise adapter's per-aspect fetches into one
      // `CruiseContent` payload. Itinerary stays empty — itinerary
      // is per-sailing, not per-cruise; the journey wires it via
      // sailing-level reads. This shim is "what's structurally true
      // about the cruise"; per-departure detail comes via journey.
      const sourceRef = entityIdToSourceRef(request.entity_id)
      const cruise = await cruiseAdapter.fetchCruise(sourceRef)
      if (!cruise) {
        throw new Error(
          `cruise content unavailable for ${request.entity_id} (adapter ${cruiseAdapter.name} returned null)`,
        )
      }

      const ship = cruise.defaultShipRef
        ? await cruiseAdapter.fetchShip(cruise.defaultShipRef)
        : null
      const sailings = await cruiseAdapter.listSailingsForCruise(cruise.sourceRef)

      const content: CruiseContent = {
        cruise: cruiseSummaryFrom(cruise),
        ship: ship ? cruiseShipFrom(ship) : null,
        sailings: sailings.map(cruiseSailingFrom),
        cabin_categories: ship?.categories?.map(cruiseCabinCategoryFrom) ?? [],
        itinerary_stops: [],
        policies: cruisePoliciesFrom(cruise),
      }

      return {
        entity_module: "cruises",
        entity_id: request.entity_id,
        source_ref: cruise.sourceRef.externalId,
        returned_locale: request.locale,
        content,
        content_schema_version: CRUISES_CONTENT_SCHEMA_VERSION,
      }
    },

    async reserve(_ctx: SourceAdapterContext, _request: ReserveRequest): Promise<ReserveResult> {
      // Cruise reservations require per-sailing context (cabin
      // category, occupancy, fare code, passengers). The catalog
      // `ReserveRequest` doesn't carry that level of detail, so v1
      // leaves cruise booking on the vertical's own commit path
      // (`POST /v1/admin/cruises/:key/booking`). When the journey
      // standardizes the descriptor, this shim can route through.
      throw new Error(
        `cruise booking via catalog SourceAdapter is not supported in v1 — call the cruises vertical's commit path directly (POST /v1/admin/cruises/:key/booking)`,
      )
    },

    async cancel(_ctx: SourceAdapterContext, _request: CancelRequest): Promise<CancelResult> {
      // Same reasoning as reserve — cancellation goes through the
      // cruise vertical's own routes for now.
      throw new Error("cruise cancellation via catalog SourceAdapter is not supported in v1")
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Translators — External* shapes → CruiseContent fields
// ─────────────────────────────────────────────────────────────────────────────

function cruiseSummaryFrom(c: ExternalCruise): CruiseContent["cruise"] {
  return {
    id: defaultBuildEntityId(c.sourceRef),
    name: c.name,
    status: c.status,
    description: c.description ?? c.shortDescription ?? null,
    cruise_type: c.cruiseType,
    hero_image_url: c.heroImageUrl ?? null,
    highlights: c.highlights ?? [],
    cruise_line: c.lineName,
    duration_nights: c.nights,
    embarkation_port: c.embarkPortName ?? null,
    disembarkation_port: c.disembarkPortName ?? null,
  }
}

function cruiseShipFrom(s: ExternalShip): NonNullable<CruiseContent["ship"]> {
  return {
    id: defaultBuildEntityId(s.sourceRef),
    name: s.name,
    description: s.description ?? null,
    capacity: s.capacityGuests ?? null,
    decks: s.deckCount ?? null,
    year_built: s.yearBuilt ?? null,
  }
}

function cruiseSailingFrom(sail: ExternalSailing): CruiseContent["sailings"][number] {
  // Sailing duration: derived from departure→return when both are
  // present. Handles the common case where the upstream ships dates
  // but no explicit duration_nights.
  const start = new Date(sail.departureDate)
  const end = new Date(sail.returnDate)
  const durationNights =
    Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
      ? Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
      : null

  return {
    id: defaultBuildEntityId(sail.sourceRef),
    source_ref: sail.sourceRef.externalId,
    start_date: sail.departureDate,
    end_date: sail.returnDate,
    duration_nights: durationNights,
    status: sail.salesStatus ?? null,
    embarkation_port: sail.embarkPortName ?? null,
    disembarkation_port: sail.disembarkPortName ?? null,
  }
}

function cruiseCabinCategoryFrom(
  cat: ExternalCabinCategory,
): CruiseContent["cabin_categories"][number] {
  return {
    id: defaultBuildEntityId(cat.sourceRef),
    code: cat.code,
    name: cat.name,
    description: cat.description ?? null,
    type: cat.roomType,
    capacity_min: cat.minOccupancy,
    capacity_max: cat.maxOccupancy,
    inclusions: cat.amenities ?? [],
  }
}

function cruisePoliciesFrom(c: ExternalCruise): CruiseContent["policies"] {
  // ExternalCruise carries `inclusionsHtml` / `exclusionsHtml` as
  // free-form HTML. Map to supplier_notes — the doc's CruisePolicy
  // shape doesn't have a dedicated "inclusions" kind, and these
  // fields are typically displayed as supplemental text rather than
  // structural rules.
  const out: CruiseContent["policies"] = []
  if (c.inclusionsHtml) {
    out.push({ kind: "supplier_notes", body: c.inclusionsHtml })
  }
  if (c.exclusionsHtml) {
    out.push({ kind: "supplier_notes", body: c.exclusionsHtml })
  }
  return out
}

// Itinerary translator — exposed for tests / future per-sailing
// composition. The shim's `getContent` doesn't currently call this
// (itinerary is per-sailing), but verticals that wire a sailing-aware
// content path can use it.
export function cruiseItineraryStopFrom(
  day: ExternalItineraryDay,
  date?: string | null,
): CruiseContent["itinerary_stops"][number] {
  return {
    day_number: day.dayNumber,
    date: date ?? null,
    port_name: day.portName ?? "",
    arrival_time: day.arrivalTime ?? null,
    departure_time: day.departureTime ?? null,
    description: day.description ?? null,
    is_at_sea: day.isSeaDay ?? false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery → CatalogProjection
// ─────────────────────────────────────────────────────────────────────────────

function toCatalogProjection(
  entry: CruiseSearchProjectionEntry,
  sourceKind: string,
  buildEntityId: (ref: SourceRef) => string,
): CatalogProjection {
  const provenance: Provenance = {
    source_kind: sourceKind,
    source_provider: entry.sourceRef.connectionId,
    source_connection_id: entry.sourceRef.connectionId,
    source_ref: entry.sourceRef.externalId,
    source_freshness: "sync",
    last_sourced_at: new Date(),
  }

  return {
    entity_module: "cruises",
    entity_id: buildEntityId(entry.sourceRef),
    provenance,
    fields: {
      id: buildEntityId(entry.sourceRef),
      name: entry.name,
      slug: entry.slug,
      cruise_type: entry.cruiseType,
      cruise_line: entry.lineName,
      ship_name: entry.shipName,
      duration_nights: entry.nights,
      embarkation_port: entry.embarkPortName ?? null,
      disembarkation_port: entry.disembarkPortName ?? null,
      regions: entry.regions ?? [],
      themes: entry.themes ?? [],
      hero_image_url: entry.heroImageUrl ?? null,
      status: entry.salesStatus ?? null,
      // Lowest-price hints aren't part of CruiseContent (pricing is
      // volatile-live), but the projection captures them so search
      // indexes downstream can render result-card price badges.
      lowest_price: entry.lowestPrice ?? null,
      lowest_price_currency: entry.lowestPriceCurrency ?? null,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cursor encoding / entity-id translation
// ─────────────────────────────────────────────────────────────────────────────

function parseCursor(cursor: DiscoveryCursor): number {
  if (!cursor) return 0
  try {
    const parsed = JSON.parse(cursor)
    if (parsed && typeof parsed === "object" && typeof parsed.offset === "number") {
      return parsed.offset
    }
  } catch {
    // fall through
  }
  return 0
}

function encodeCursor(offset: number): DiscoveryCursor {
  return JSON.stringify({ offset })
}

/**
 * Default `entity_id` builder. Produces stable Voyant-side ids of the
 * form `crus_<slug>` from the upstream `externalId`. Stability is
 * load-bearing: `catalog_sourced_entries` is keyed on `entity_id`, so
 * if this changes between syncs we'd lose the link to overlays /
 * snapshots.
 */
function defaultBuildEntityId(sourceRef: SourceRef): string {
  const slug =
    String(sourceRef.externalId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 26) || "unknown"
  return `crus_${slug}`
}

/**
 * Inverse of `defaultBuildEntityId` — recovers a `SourceRef` from a
 * catalog-side entity_id. Used by `getContent` when the catalog
 * dispatches by entity_id rather than by SourceRef. Returns a minimal
 * `SourceRef` (just the externalId) — the upstream connectionId / vendor
 * fields are NOT recoverable from the entity_id alone, so callers that
 * need the connection should pass `SourceAdapterContext.connection_id`
 * via the adapter context.
 */
function entityIdToSourceRef(entityId: string): SourceRef {
  const externalId = entityId.startsWith("crus_") ? entityId.slice("crus_".length) : entityId
  return { externalId }
}
