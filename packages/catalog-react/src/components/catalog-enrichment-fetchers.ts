/**
 * Back-compat re-export. The catalog detail enrichment client + its
 * `CatalogDetailEnrichment` view-model moved to the data layer
 * (`@voyant-travel/catalog-react`); this shim preserves the
 * `@voyant-travel/catalog-react/ui` import surface.
 */
export {
  __resetEnrichmentFetcherWarnings,
  // fallow-ignore-next-line unused-type
  type CatalogDeparturePricingRow,
  // fallow-ignore-next-line unused-type
  type CatalogDetailEnrichment,
  type CatalogEnrichmentFetchers,
  type CatalogEnrichmentFetchersOptions,
  type CatalogSlotAvailability,
  createCatalogEnrichmentFetchers,
} from "../index.js"
