import type { LinkableDefinition, Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { facilitiesRoutes } from "./routes.js"
import { facilitiesService } from "./service.js"

export type { FacilitiesRoutes } from "./routes.js"

/**
 * Properties and facilities exposed as linkable entities so other modules can
 * associate to them via `defineLink` (e.g. a room block → its property). See
 * RFC voyant#1489.
 */
export const propertyLinkable: LinkableDefinition = {
  module: "operations",
  entity: "property",
  table: "properties",
  idPrefix: "prop",
}

export const facilityLinkable: LinkableDefinition = {
  module: "operations",
  entity: "facility",
  table: "facilities",
  idPrefix: "fac",
}

/** Function spaces (meeting/event sub-spaces) — linkable so a MICE session can target one. */
export const functionSpaceLinkable: LinkableDefinition = {
  module: "operations",
  entity: "functionSpace",
  table: "function_spaces",
  idPrefix: "fnsp",
}

export const placesLinkable = {
  property: propertyLinkable,
  facility: facilityLinkable,
  functionSpace: functionSpaceLinkable,
}

export const facilitiesModule: Module = {
  name: "facilities",
  linkable: placesLinkable,
}

export const facilitiesHonoModule: HonoModule = {
  module: facilitiesModule,
  routes: facilitiesRoutes,
}

export const placesModule: Module = {
  name: "places",
}

export const placesHonoModule: HonoModule = {
  module: placesModule,
  routes: facilitiesRoutes,
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
export { functionSpaceService } from "./service-function-spaces.js"
export * from "./validation-function-spaces.js"
