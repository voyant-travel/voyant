import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { availabilityRoutes } from "./routes.js"
import { availabilityService } from "./service.js"

export type { AvailabilityRoutes } from "./routes.js"

export const availabilityModule: Module = {
  name: "availability",
}

export const availabilityHonoModule: HonoModule = {
  module: availabilityModule,
  routes: availabilityRoutes,
}

export {
  AVAILABILITY_SLOT_CHANGED_EVENT,
  type AvailabilitySlotChangedEvent,
  type AvailabilitySlotChangeSource,
} from "./events.js"
export {
  type GenerateAvailabilitySlotsOptions,
  type GenerateAvailabilitySlotsResult,
  generateAvailabilitySlots,
} from "./generate-slots.js"
export type {
  AvailabilityCloseout,
  AvailabilityPickupPoint,
  AvailabilityRule,
  AvailabilitySlot,
  AvailabilitySlotPickup,
  AvailabilityStartTime,
  CustomPickupArea,
  LocationPickupTime,
  NewAvailabilityCloseout,
  NewAvailabilityPickupPoint,
  NewAvailabilityRule,
  NewAvailabilitySlot,
  NewAvailabilitySlotPickup,
  NewAvailabilityStartTime,
  NewCustomPickupArea,
  NewLocationPickupTime,
  NewPickupGroup,
  NewPickupLocation,
  NewProductMeetingConfig,
  PickupGroup,
  PickupLocation,
  ProductMeetingConfig,
} from "./schema.js"
export {
  availabilityCloseouts,
  availabilityPickupPoints,
  availabilityRules,
  availabilitySlotPickups,
  availabilitySlots,
  availabilityStartTimes,
  customPickupAreas,
  locationPickupTimes,
  pickupGroups,
  pickupLocations,
  productMeetingConfigs,
} from "./schema.js"
export {
  availabilityCloseoutListQuerySchema,
  availabilityPickupPointListQuerySchema,
  availabilityRuleListQuerySchema,
  availabilitySlotListQuerySchema,
  availabilitySlotPickupListQuerySchema,
  availabilityStartTimeListQuerySchema,
  customPickupAreaListQuerySchema,
  insertAvailabilityCloseoutSchema,
  insertAvailabilityPickupPointSchema,
  insertAvailabilityRuleSchema,
  insertAvailabilitySlotPickupSchema,
  insertAvailabilitySlotSchema,
  insertAvailabilityStartTimeSchema,
  insertCustomPickupAreaSchema,
  insertLocationPickupTimeSchema,
  insertPickupGroupSchema,
  insertPickupLocationSchema,
  insertProductMeetingConfigSchema,
  locationPickupTimeListQuerySchema,
  pickupGroupListQuerySchema,
  pickupLocationListQuerySchema,
  productMeetingConfigListQuerySchema,
  updateAvailabilityCloseoutSchema,
  updateAvailabilityPickupPointSchema,
  updateAvailabilityRuleSchema,
  updateAvailabilitySlotPickupSchema,
  updateAvailabilitySlotSchema,
  updateAvailabilityStartTimeSchema,
  updateCustomPickupAreaSchema,
  updateLocationPickupTimeSchema,
  updatePickupGroupSchema,
  updatePickupLocationSchema,
  updateProductMeetingConfigSchema,
} from "./validation.js"
export { availabilityService }
