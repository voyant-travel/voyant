import type { Module } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { stampOpenApiRegistryApiId } from "@voyant-travel/hono"
import type { ApiModule } from "@voyant-travel/hono/module"

import { bookingsExtrasRoutes } from "./extras/routes.js"

export type { BookingsExtrasRoutes } from "./extras/routes.js"
export { BOOKINGS_EXTRAS_OPENAPI_API_ID } from "./extras/routes-openapi.js"
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
  name: "bookings-extras",
}

export const bookingsExtrasApiModule: ApiModule = {
  module: bookingsExtrasModule,
  adminRoutes: bookingsExtrasRoutes,
}

export const createBookingsExtrasVoyantRuntime = defineGraphRuntimeFactory(async ({ api }) => {
  const adminApiId = api.find(({ surface }) => surface === "admin")?.id
  return {
    module: bookingsExtrasApiModule.module,
    ...(adminApiId
      ? {
          adminRoutes: stampOpenApiRegistryApiId(bookingsExtrasApiModule.adminRoutes, adminApiId),
        }
      : {}),
  }
})
