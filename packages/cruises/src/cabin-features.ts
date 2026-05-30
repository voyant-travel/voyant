/**
 * Cabin facet vocabularies now live in `@voyantjs/cruises-contracts` so
 * external adapter authors can validate cabin facets without the cruises
 * runtime. Re-exported here to keep the existing `@voyantjs/cruises`
 * import path stable for the runtime catalog/schema/validation modules.
 */
export * from "@voyantjs/cruises-contracts/cabin-features"
