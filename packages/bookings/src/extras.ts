import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { bookingsExtrasRoutes } from "./extras/routes.js"

export type { BookingsExtrasRoutes } from "./extras/routes.js"
export type {
  BookingExtra,
  ExtraParticipantSelection,
  NewBookingExtra,
  NewExtraParticipantSelection,
} from "./extras/schema.js"
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
} from "./extras/schema.js"
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

export const bookingsExtrasModule: Module = {
  name: "extras",
}

export const bookingsExtrasHonoModule: HonoModule = {
  module: bookingsExtrasModule,
  routes: bookingsExtrasRoutes,
}
