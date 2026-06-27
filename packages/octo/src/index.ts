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
  // Dual-mount (voyant#2114): the same `OpenAPIHono` instance is mounted on the
  // legacy `/v1/octo/*` surface (back-compat) AND the documented partner surface
  // at `/v1/public/octo/*`. OCTo (Open Connectivity for Tours & Activities) is a
  // connectivity API consumed by resellers/suppliers — a partner-facing surface,
  // not a staff admin dashboard — so the documented leg is `publicRoutes`, not
  // `adminRoutes`. The legacy `routes` mount is retained so no existing caller
  // breaks.
  routes: octoRoutes,
  publicRoutes: octoRoutes,
}

export { octoRoutes, octoService }
