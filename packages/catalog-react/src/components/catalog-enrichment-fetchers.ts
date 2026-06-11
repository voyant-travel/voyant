/**
 * Back-compat re-export. The catalog detail enrichment client + its
 * `CatalogDetailEnrichment` view-model moved to the data layer
 * (`@voyantjs/catalog-react`); this shim preserves the
 * `@voyantjs/catalog-ui` import surface.
 */
export {
  __resetEnrichmentFetcherWarnings,
  type CatalogDeparturePricingRow,
  type CatalogDetailEnrichment,
  type CatalogEnrichmentFetchers,
  type CatalogEnrichmentFetchersOptions,
  type CatalogSlotAvailability,
  createCatalogEnrichmentFetchers,
} from "../index.js"
