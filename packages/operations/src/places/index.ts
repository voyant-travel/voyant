import type { Module } from "@voyant-travel/core"
import type { ApiModule } from "@voyant-travel/hono/module"

import { placesLinkable } from "./linkables.js"
import { facilitiesRoutes } from "./routes.js"
import { facilitiesService } from "./service.js"

export {
  facilityLinkable,
  functionSpaceLinkable,
  placesLinkable,
  propertyLinkable,
  spaceBlockLinkable,
} from "./linkables.js"
export type { FacilitiesRoutes } from "./routes.js"

export const facilitiesModule: Module = {
  name: "facilities",
  linkable: placesLinkable,
}

export const facilitiesApiModule: ApiModule = {
  module: facilitiesModule,
  adminRoutes: facilitiesRoutes,
}

export const placesModule: Module = {
  name: "places",
}

export const placesApiModule: ApiModule = {
  module: placesModule,
  adminRoutes: facilitiesRoutes,
}

export type {
  Facility,
  Facility as Place,
  FacilityAddressProjection,
  FacilityAddressProjection as PlaceAddressProjection,
  FacilityContact,
  FacilityContact as PlaceContact,
  FacilityFeature,
  FacilityFeature as PlaceFeature,
  FacilityOperationSchedule,
  FacilityOperationSchedule as PlaceOperationSchedule,
  NewFacility,
  NewFacility as NewPlace,
  NewFacilityAddressProjection,
  NewFacilityAddressProjection as NewPlaceAddressProjection,
  NewFacilityContact,
  NewFacilityContact as NewPlaceContact,
  NewFacilityFeature,
  NewFacilityFeature as NewPlaceFeature,
  NewFacilityOperationSchedule,
  NewFacilityOperationSchedule as NewPlaceOperationSchedule,
  NewProperty,
  NewPropertyGroup,
  NewPropertyGroupMember,
  Property,
  PropertyGroup,
  PropertyGroupMember,
} from "./schema.js"
export {
  facilities,
  facilities as places,
  facilityAddressProjections,
  facilityAddressProjections as placeAddressProjections,
  facilityFeatures,
  facilityFeatures as placeFeatures,
  facilityOperationSchedules,
  facilityOperationSchedules as placeOperationSchedules,
  properties,
  propertyGroupMembers,
  propertyGroups,
} from "./schema.js"
export {
  facilityContactListQuerySchema,
  facilityContactListQuerySchema as placeContactListQuerySchema,
  facilityFeatureListQuerySchema,
  facilityFeatureListQuerySchema as placeFeatureListQuerySchema,
  facilityListQuerySchema,
  facilityListQuerySchema as placeListQuerySchema,
  facilityOperationScheduleListQuerySchema,
  facilityOperationScheduleListQuerySchema as placeOperationScheduleListQuerySchema,
  insertFacilityContactSchema,
  insertFacilityContactSchema as insertPlaceContactSchema,
  insertFacilityFeatureSchema,
  insertFacilityFeatureSchema as insertPlaceFeatureSchema,
  insertFacilityOperationScheduleSchema,
  insertFacilityOperationScheduleSchema as insertPlaceOperationScheduleSchema,
  insertFacilitySchema,
  insertFacilitySchema as insertPlaceSchema,
  insertPropertyGroupMemberSchema,
  insertPropertyGroupSchema,
  insertPropertySchema,
  propertyGroupListQuerySchema,
  propertyGroupMemberListQuerySchema,
  propertyListQuerySchema,
  updateFacilityContactSchema,
  updateFacilityContactSchema as updatePlaceContactSchema,
  updateFacilityFeatureSchema,
  updateFacilityFeatureSchema as updatePlaceFeatureSchema,
  updateFacilityOperationScheduleSchema,
  updateFacilityOperationScheduleSchema as updatePlaceOperationScheduleSchema,
  updateFacilitySchema,
  updateFacilitySchema as updatePlaceSchema,
  updatePropertyGroupMemberSchema,
  updatePropertyGroupSchema,
  updatePropertySchema,
} from "./validation.js"
export { facilitiesService }
export const placesService = facilitiesService

export type {
  FunctionSpace,
  FunctionSpaceCapacity,
  NewFunctionSpace,
  NewFunctionSpaceCapacity,
} from "./schema-function-spaces.js"
export {
  functionSpaceCapacities,
  functionSpaceLayoutEnum,
  functionSpaces,
} from "./schema-function-spaces.js"
export type {
  NewSpaceBlock,
  NewSpaceBlockPickup,
  NewSpaceBlockSlot,
  SpaceBlock,
  SpaceBlockPickup,
  SpaceBlockSlot,
} from "./schema-space-blocks.js"
export {
  spaceBlockPickups,
  spaceBlockSlots,
  spaceBlocks,
} from "./schema-space-blocks.js"
export { functionSpaceService } from "./service-function-spaces.js"
export { spaceBlockService } from "./service-space-blocks.js"
export * from "./validation-function-spaces.js"
export * from "./validation-space-blocks.js"
