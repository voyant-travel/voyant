/**
 * Bookings-owned extras facade.
 *
 * Booking extra lines, participant selections, and slot manifests are
 * booking-facing state. The legacy extras package remains a temporary schema
 * and route compatibility shim until the shared table graph can be split
 * without migration churn.
 */

import { extrasHonoModule, extrasService } from "@voyantjs/extras"

export type { ExtrasRoutes as BookingsExtrasRoutes } from "@voyantjs/extras/routes"
export { extrasRoutes as bookingsExtrasRoutes } from "@voyantjs/extras/routes"
export type {
  BookingExtra,
  ExtraParticipantSelection,
  NewBookingExtra,
  NewExtraParticipantSelection,
  NewOptionExtraConfig,
  NewProductExtra,
  OptionExtraConfig,
  ProductExtra,
} from "@voyantjs/extras/schema"
export {
  bookingExtraStatusEnum,
  bookingExtras,
  bookingExtrasRelations,
  extraCollectionModeEnum,
  extraCollectionStatusEnum,
  extraParticipantSelectionStatusEnum,
  extraParticipantSelections,
  extraParticipantSelectionsRelations,
  extraPricingModeEnum,
  extraSelectionTypeEnum,
  optionExtraConfigs,
  optionExtraConfigsRelations,
  productExtras,
  productExtrasRelations,
} from "@voyantjs/extras/schema"
export {
  buildExtraSnapshotInput,
  getResolvedExtraById,
  listResolvedExtras,
  type ProductExtraCatalogContext,
  productExtraRowToProjection,
  type ResolvedView,
  type ResolverScope,
} from "@voyantjs/extras/service-catalog-plane"
export {
  bookingExtraCoreSchema,
  bookingExtraListQuerySchema,
  bookingExtraStatusSchema,
  extraCollectionModeSchema,
  extraCollectionStatusSchema,
  extraParticipantSelectionStatusSchema,
  extraPricingModeSchema,
  extraSelectionTypeSchema,
  insertBookingExtraSchema,
  slotExtraCollectionBulkSchema,
  slotExtraManifestQuerySchema,
  slotExtraSelectionBulkSchema,
  slotExtraSelectionPatchSchema,
  updateBookingExtraSchema,
} from "@voyantjs/extras/validation"

export const bookingsExtrasService = {
  listBookingExtras: extrasService.listBookingExtras,
  getBookingExtraById: extrasService.getBookingExtraById,
  createBookingExtra: extrasService.createBookingExtra,
  updateBookingExtra: extrasService.updateBookingExtra,
  deleteBookingExtra: extrasService.deleteBookingExtra,
  getSlotExtraManifest: extrasService.getSlotExtraManifest,
  setSlotExtraSelection: extrasService.setSlotExtraSelection,
  bulkSetSlotExtraSelections: extrasService.bulkSetSlotExtraSelections,
  bulkUpdateSlotExtraCollections: extrasService.bulkUpdateSlotExtraCollections,
}

/**
 * Compatibility Hono module for the existing `/v1/extras` URL surface.
 * New package imports should resolve it through `@voyantjs/bookings/extras`.
 */
export const bookingsExtrasHonoModule = extrasHonoModule
