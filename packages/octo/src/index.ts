import type { Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { octoRoutes } from "./routes.js"
import { octoService } from "./service.js"

export type { OctoRoutes } from "./routes.js"
export type {
  OctoAvailabilityStatus,
  OctoAvailabilityType,
  OctoBookingStatus,
  OctoProjectedAvailability,
  OctoProjectedBooking,
  OctoProjectedBookingArtifact,
  OctoProjectedBookingContact,
  OctoProjectedBookingFulfillment,
  OctoProjectedBookingRedemptionEvent,
  OctoProjectedBookingReferences,
  OctoProjectedBookingSupplierReference,
  OctoProjectedBookingUnitItem,
  OctoProjectedOption,
  OctoProjectedProduct,
  OctoProjectedProductContent,
  OctoProjectedUnit,
  OctoUnitType,
} from "./types.js"
export {
  octoAvailabilityCalendarQuerySchema,
  octoAvailabilityListQuerySchema,
  octoBookingListQuerySchema,
  octoProductListQuerySchema,
} from "./validation.js"

export const octoModule: Module = {
  name: "octo",
}

export const octoHonoModule: HonoModule = {
  module: octoModule,
  routes: octoRoutes,
}

export { octoRoutes, octoService }
