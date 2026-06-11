/**
 * `BookingDraftShape` + the shared draft-shape defaults now live in
 * `@voyantjs/catalog-contracts` so client packages (bookings-react,
 * catalog-react) and adapter authors can consume the journey descriptor
 * without the catalog runtime. Re-exported here to keep existing
 * `@voyantjs/catalog` import paths stable. See
 * `docs/adr/0002-contract-packages.md`.
 */
export * from "@voyantjs/catalog-contracts/booking-engine/draft-shape"
