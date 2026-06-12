import type { SourceRef } from "./adapters/index.js"
import type { CruiseSearchIndexRow } from "./schema-search.js"

// ---------- query payload ----------

export type SearchIndexQueryResult = {
  data: CruiseSearchIndexRow[]
  total: number
  limit: number
  offset: number
}

// ---------- bulk upsert payload (adapters call this) ----------

export type BulkSearchIndexEntry = {
  source: "local" | "external"
  sourceProvider?: string | null
  sourceRef?: SourceRef | null
  localCruiseId?: string | null
  slug: string
  name: string
  cruiseType: "ocean" | "river" | "expedition" | "coastal"
  lineName: string
  shipName: string
  nights: number
  embarkPortName?: string | null
  embarkPortCanonicalPlaceId?: string | null
  disembarkPortName?: string | null
  disembarkPortCanonicalPlaceId?: string | null
  regionIds?: string[]
  waterwayIds?: string[]
  portIds?: string[]
  countryIso?: string[]
  regions?: string[]
  waterways?: string[]
  ports?: string[]
  countries?: string[]
  themes?: string[]
  earliestDeparture?: string | null
  latestDeparture?: string | null
  departureCount?: number | null
  lowestPriceCents?: number | null
  lowestPriceCurrency?: string | null
  salesStatus?: string | null
  heroImageUrl?: string | null
}

export type RebuildResult = {
  localUpserted: number
  externalUpserted: number
  externalRemoved: number
  externalErrors: Array<{ adapter: string; error: string }>
}

export type ExternalAdapterRefreshResult = {
  upserted: number
  removed: number
}
