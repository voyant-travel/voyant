/**
 * Aggregated drizzle table exports for the catalog plane.
 *
 * Templates point their `drizzle.config.ts` at this single module to pick
 * up every catalog-plane table in one go. Keeps the template config small
 * and avoids the template having to track which catalog-plane sub-paths
 * carry tables.
 *
 * Tables exported:
 *   - `catalogOverlayTable`           — editorial overrides (§5.2)
 *   - `bookingCatalogSnapshotTable`   — frozen booking snapshots (§5.3)
 *   - `catalogQuotesTable`            — booking-engine quote records
 */

export {
  catalogQuotesTable,
  type InsertCatalogQuote,
  type SelectCatalogQuote,
} from "./booking-engine/schema.js"
export {
  catalogOverlayTable,
  type InsertCatalogOverlay,
  OVERLAY_DEFAULT_SCOPE,
  type OverlayOrigin,
  type SelectCatalogOverlay,
} from "./overlay/schema.js"
export {
  bookingCatalogSnapshotTable,
  type InsertBookingCatalogSnapshot,
  type PricingBasis,
  readPricingBasis,
  type SelectBookingCatalogSnapshot,
} from "./snapshot/schema.js"
