/**
 * Structured Voyant Connect cruise sourcing.
 *
 * The generic `createVoyantConnectSourceAdapter` (@voyantjs/connect-adapter)
 * discovers cruises through `operators.listSearchDocuments`, which flattens a
 * cruise to `destinations` / `country_codes` / `tags` and drops the canonical
 * geography (rivers/waterways, regions, ports, countries). To index the
 * destination facets the cruise vertical declares, sourced cruises must instead
 * flow through the structured cruise adapter (`createConnectCruiseAdapter`),
 * whose `searchProjection()` lifts the canonical geography off the catalog
 * projection onto each entry — and through the cruise vertical's
 * `cruiseAdapterToSourceAdapter` shim, which maps those geo fields into the
 * catalog projection the indexer facets on.
 *
 * Single source of truth for both the `sync:sources` CLI and the runtime
 * booking-engine registry so the two paths can't drift on which adapter sources
 * cruises (mirrors `catalog-runtime.ts`'s shared-policy approach).
 */

import type { ProjectionDefaults } from "@voyantjs/connect-adapter"
import { type CatalogProjection, mapSearchDocumentToProjection } from "@voyantjs/connect-adapter"
import {
  type ConnectCruiseAdapterOptions,
  createConnectCruiseAdapter,
} from "@voyantjs/connect-cruises"
import type { SearchDocument } from "@voyantjs/connect-sdk"
import { type MemoizeOptions, memoizeCruiseAdapter } from "@voyantjs/cruises"
import {
  type CruiseAdapter,
  type CruiseSearchProjectionEntry,
  type CruiseSourceAdapterShim,
  type CruiseSourceAdapterShimOptions,
  cruiseAdapterToSourceAdapter,
} from "@voyantjs/cruises/adapters"

import type { GeoNameResolver } from "./geo-resolver"

/**
 * `mapDocument` for the generic Voyant Connect adapter that drops cruise
 * documents so they're sourced exclusively through the structured cruise
 * adapter (which preserves the canonical geography). Returns `null` for cruise
 * projections; defers to the default mapping for every other vertical.
 *
 * Without this, the same upstream cruise lands twice — once via the generic
 * flat path (no geo) and once via the structured path — under different
 * `entity_id`s, double-counting the cruise collection.
 */
export function skipCruiseConnectDocuments(
  document: SearchDocument,
  defaults: ProjectionDefaults,
): CatalogProjection | null {
  const projection = mapSearchDocumentToProjection(document, defaults)
  if (projection?.entity_module === "cruises") return null
  return projection
}

/**
 * Build a catalog `SourceAdapter` that sources Connect cruises into the cruise
 * vertical with the canonical geography intact. Wraps the structured adapter in
 * the TTL memoizer (caches per-cruise detail reads) and the cruise-vertical
 * catalog shim (`discover()` → geo-bearing `CatalogProjection`s).
 */
export function createConnectCruiseSourceAdapter(
  options: ConnectCruiseAdapterOptions,
  shimOptions?: CruiseSourceAdapterShimOptions,
  extras?: { memoize?: MemoizeOptions; geo?: GeoNameResolver },
): CruiseSourceAdapterShim {
  // The published `ConnectCruiseAdapter` is the same method surface as the
  // cruise vertical's `CruiseAdapter`, but its `fetchSailingPricing` types the
  // price-component `kind` as `string` (vs the vertical's narrowed union). The
  // shim's `discover()` / `getContent()` never read price components, so the
  // cast is runtime-safe; it only bridges the published contract drift.
  let adapter = memoizeCruiseAdapter(
    createConnectCruiseAdapter(options) as unknown as CruiseAdapter,
    extras?.memoize,
  )
  if (extras?.geo) adapter = withResolvedGeoNames(adapter, extras.geo)
  return cruiseAdapterToSourceAdapter(adapter, shimOptions)
}

/**
 * Wrap a cruise adapter so its `searchProjection` stream fills `ports` /
 * `regions` / `waterways` name arrays from the matching `*Ids` via Voyant Data
 * geo, when the upstream only carried ids (e.g. ports). Names that are already
 * present (upstream-resolved) are left untouched.
 */
function withResolvedGeoNames(adapter: CruiseAdapter, geo: GeoNameResolver): CruiseAdapter {
  return {
    ...adapter,
    searchProjection: (opts) => resolveGeoNamesOnEntries(adapter.searchProjection(opts), geo),
  }
}

async function* resolveGeoNamesOnEntries(
  source: AsyncIterable<CruiseSearchProjectionEntry>,
  geo: GeoNameResolver,
): AsyncIterable<CruiseSearchProjectionEntry> {
  for await (const entry of source) {
    if (!entry.ports?.length && entry.portIds?.length) {
      entry.ports = await geo.resolveMany(entry.portIds)
    }
    if (!entry.regions?.length && entry.regionIds?.length) {
      entry.regions = await geo.resolveMany(entry.regionIds)
    }
    if (!entry.waterways?.length && entry.waterwayIds?.length) {
      entry.waterways = await geo.resolveMany(entry.waterwayIds)
    }
    yield entry
  }
}
