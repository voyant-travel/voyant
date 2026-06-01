/**
 * `BookingDraft` + V1 engine contract schemas now live in
 * `@voyantjs/catalog-contracts` so external consumers (Voyant Connect, adapter
 * authors, the Admin SDK) can validate booking-engine payloads without the
 * catalog runtime. Re-exported here to keep existing `@voyantjs/catalog`
 * import paths stable. See `docs/adr/0002-contract-packages.md`.
 */
export * from "@voyantjs/catalog-contracts/booking-engine/contracts"
