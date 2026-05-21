import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { availabilityAdminRoutes, availabilityRoutes } from "./routes.js"
import { availabilityService } from "./service.js"

export type { AvailabilityAdminRoutes, AvailabilityRoutes } from "./routes.js"

export const availabilityModule: Module = {
  name: "availability",
  requiresTransactionalDb: true,
}

export const availabilityHonoModule: HonoModule = {
  module: availabilityModule,
  routes: availabilityRoutes,
  adminRoutes: availabilityAdminRoutes,
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
  AllocationAuditLog,
  AllocationResource,
  AvailabilityCloseout,
  AvailabilityPickupPoint,
  AvailabilityRule,
  AvailabilitySlot,
  AvailabilitySlotPickup,
  AvailabilityStartTime,
  CustomPickupArea,
  LocationPickupTime,
  NewAllocationResource,
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
  NewProductOptionResourceTemplate,
  PickupGroup,
  PickupLocation,
  ProductMeetingConfig,
  ProductOptionResourceTemplate,
  SharingGroupLabel,
} from "./schema.js"
export {
  allocationAuditLog,
  allocationResources,
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
  productOptionResourceTemplates,
  sharingGroupLabels,
} from "./schema.js"
export {
  getSlotResourceAvailability,
  getSlotsResourceAvailability,
  type PlannedAllocation,
  type ResourceCapacityViolation,
  type SlotResourceAvailability,
  validateSlotAllocationCapacity,
} from "./service-allocation.js"
export {
  type MaterializeSlotResourcesFromTemplatesOptions,
  materializeSlotResourcesFromTemplateDefaults,
} from "./service-allocation-automation.js"
export {
  allocationExportFilename,
  buildAllocationPassengersCsv,
  buildAllocationRoomingCsv,
} from "./service-allocation-exports.js"
export {
  allocationAuditLogQuerySchema,
  allocationAutomationSchema,
  assignTravelerAllocationSchema,
  availabilityCloseoutListQuerySchema,
  availabilityPickupPointListQuerySchema,
  availabilityRuleListQuerySchema,
  availabilitySlotListQuerySchema,
  availabilitySlotPickupListQuerySchema,
  availabilityStartTimeListQuerySchema,
  customPickupAreaListQuerySchema,
  insertAllocationResourceSchema,
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
  pairSharingGroupSchema,
  pickupGroupListQuerySchema,
  pickupLocationListQuerySchema,
  productMeetingConfigListQuerySchema,
  updateAllocationResourceSchema,
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
  updateSharingGroupLabelSchema,
  updateTravelerSharingGroupSchema,
  upsertResourceTemplateSchema,
} from "./validation.js"
export { availabilityService }
