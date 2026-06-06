import type { LinkableDefinition, Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { availabilityAdminRoutes, availabilityRoutes } from "./routes.js"
import { availabilityService } from "./service.js"

export type { AvailabilityAdminRoutes, AvailabilityRoutes } from "./routes.js"

/**
 * A "departure" in the catalog/profitability sense is a scheduled
 * availability slot. Exposed so cost allocations / reports can reference it.
 */
export const departureLinkable: LinkableDefinition = {
  module: "availability",
  entity: "departure",
  table: "availability_slots",
  idPrefix: "avsl",
}

export const availabilityLinkable = {
  departure: departureLinkable,
}

export const availabilityModule: Module = {
  name: "availability",
  requiresTransactionalDb: true,
  linkable: availabilityLinkable,
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
  type AllocationManifestBooking,
  type AllocationManifestTraveler,
  getSlotAllocationManifest,
  getSlotResourceAvailability,
  getSlotsResourceAvailability,
  type PlannedAllocation,
  type ResourceCapacityViolation,
  type SlotAllocationManifest,
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
  availabilityOverviewQuerySchema,
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
  type SeatLayoutCell,
  type SeatLayoutSpec,
  seatLayoutCellSchema,
  seatLayoutSpecSchema,
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
