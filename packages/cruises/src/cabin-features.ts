/**
 * Cabin facet vocabularies now live in `@voyant-travel/cruises-contracts` so
 * external adapter authors can validate cabin facets without the cruises
 * runtime. Re-exported here to keep the existing `@voyant-travel/cruises`
 * import path stable for the runtime catalog/schema/validation modules.
 */
export * from "@voyant-travel/cruises-contracts/cabin-features"
