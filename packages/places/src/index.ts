import type { Module } from "@voyantjs/core"
import { facilitiesService } from "@voyantjs/facilities"
import { facilitiesRoutes } from "@voyantjs/facilities/routes"
import type { HonoModule } from "@voyantjs/hono/module"

export type { PlacesRoutes } from "./routes.js"

export const placesModule: Module = {
  name: "places",
}

export const placesHonoModule: HonoModule = {
  module: placesModule,
  routes: facilitiesRoutes,
}

export const placesService: typeof facilitiesService = facilitiesService

export * from "@voyantjs/facilities"
export type {
  Facility as Place,
  FacilityAddressProjection as PlaceAddressProjection,
  FacilityContact as PlaceContact,
  FacilityFeature as PlaceFeature,
  FacilityOperationSchedule as PlaceOperationSchedule,
  NewFacility as NewPlace,
  NewFacilityAddressProjection as NewPlaceAddressProjection,
  NewFacilityContact as NewPlaceContact,
  NewFacilityFeature as NewPlaceFeature,
  NewFacilityOperationSchedule as NewPlaceOperationSchedule,
} from "@voyantjs/facilities/schema"
export {
  facilities as places,
  facilityAddressProjections as placeAddressProjections,
  facilityFeatures as placeFeatures,
  facilityOperationSchedules as placeOperationSchedules,
} from "@voyantjs/facilities/schema"
export {
  facilityContactListQuerySchema as placeContactListQuerySchema,
  facilityFeatureListQuerySchema as placeFeatureListQuerySchema,
  facilityListQuerySchema as placeListQuerySchema,
  facilityOperationScheduleListQuerySchema as placeOperationScheduleListQuerySchema,
  insertFacilityContactSchema as insertPlaceContactSchema,
  insertFacilityFeatureSchema as insertPlaceFeatureSchema,
  insertFacilityOperationScheduleSchema as insertPlaceOperationScheduleSchema,
  insertFacilitySchema as insertPlaceSchema,
  updateFacilityContactSchema as updatePlaceContactSchema,
  updateFacilityFeatureSchema as updatePlaceFeatureSchema,
  updateFacilityOperationScheduleSchema as updatePlaceOperationScheduleSchema,
  updateFacilitySchema as updatePlaceSchema,
} from "@voyantjs/facilities/validation"
