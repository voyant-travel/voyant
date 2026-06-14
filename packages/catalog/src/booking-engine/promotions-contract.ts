/**
 * Promotion-evaluation contract types now live in `@voyant-travel/catalog-contracts`
 * so external consumers can validate promotion payloads without the catalog
 * runtime. Re-exported here to keep existing `@voyant-travel/catalog` import paths
 * stable. See `docs/adr/0002-contract-packages.md`.
 */
export * from "@voyant-travel/catalog-contracts/booking-engine/promotions-contract"
