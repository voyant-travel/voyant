/**
 * Promotion-evaluation contract types now live in `@voyantjs/catalog-contracts`
 * so external consumers can validate promotion payloads without the catalog
 * runtime. Re-exported here to keep existing `@voyantjs/catalog` import paths
 * stable. See `docs/adr/0002-contract-packages.md`.
 */
export * from "@voyantjs/catalog-contracts/booking-engine/promotions-contract"
