/**
 * Bookings-owned extras facade.
 *
 * Booking extra lines, participant selections, and slot manifests are
 * booking-facing state. Their runtime routes and services live here; the
 * legacy extras package remains the temporary table/schema location until the
 * shared product-extra FK graph can be split without migration churn.
 */

import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { bookingsExtrasRoutes } from "./extras/routes.js"

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
  insertOptionExtraConfigSchema,
  insertProductExtraSchema,
  optionExtraConfigCoreSchema,
  optionExtraConfigListQuerySchema,
  productExtraCoreSchema,
  productExtraListQuerySchema,
  updateOptionExtraConfigSchema,
  updateProductExtraSchema,
} from "@voyantjs/extras/validation"
export type { BookingsExtrasRoutes } from "./extras/routes.js"
export { bookingsExtrasService } from "./extras/service.js"
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
} from "./extras/validation.js"
export { bookingsExtrasRoutes }

/**
 * Compatibility Hono module for the existing `/v1/extras` URL surface.
 * New package imports should resolve it through `@voyantjs/bookings/extras`.
 */
export const bookingsExtrasModule: Module = {
  name: "extras",
}

export const bookingsExtrasHonoModule: HonoModule = {
  module: bookingsExtrasModule,
  routes: bookingsExtrasRoutes,
}
