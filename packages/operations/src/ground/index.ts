import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { groundRoutes } from "./routes.js"
import { groundService } from "./service.js"

export type { GroundRoutes } from "./routes.js"

export const groundModule: Module = {
  name: "ground",
}

export const groundHonoModule: HonoModule = {
  module: groundModule,
  routes: groundRoutes,
}

export type {
  GroundDispatch,
  GroundDriver,
  GroundExecutionEvent,
  GroundOperator,
  GroundTransferPreference,
  GroundVehicle,
  NewGroundDispatch,
  NewGroundDriver,
  NewGroundExecutionEvent,
  NewGroundOperator,
  NewGroundTransferPreference,
  NewGroundVehicle,
} from "./schema.js"
export {
  groundDispatches,
  groundDispatchStatusEnum,
  groundDrivers,
  groundExecutionEvents,
  groundExecutionEventTypeEnum,
  groundOperators,
  groundServiceLevelEnum,
  groundTransferPreferences,
  groundVehicleCategoryEnum,
  groundVehicleClassEnum,
  groundVehicles,
} from "./schema.js"
export {
  groundAssignmentSourceSchema,
  groundCheckpointStatusSchema,
  groundDispatchAssignmentListQuerySchema,
  groundDispatchLegListQuerySchema,
  groundDispatchLegTypeSchema,
  groundDispatchListQuerySchema,
  groundDispatchPassengerListQuerySchema,
  groundDispatchStatusSchema,
  groundDriverListQuerySchema,
  groundDriverShiftListQuerySchema,
  groundExecutionEventListQuerySchema,
  groundExecutionEventTypeSchema,
  groundIncidentResolutionStatusSchema,
  groundIncidentSeveritySchema,
  groundOperatorListQuerySchema,
  groundServiceIncidentListQuerySchema,
  groundServiceLevelSchema,
  groundTransferPreferenceListQuerySchema,
  groundVehicleCategorySchema,
  groundVehicleClassSchema,
  groundVehicleListQuerySchema,
  insertGroundDispatchAssignmentSchema,
  insertGroundDispatchCheckpointSchema,
  insertGroundDispatchLegSchema,
  insertGroundDispatchPassengerSchema,
  insertGroundDispatchSchema,
  insertGroundDriverSchema,
  insertGroundDriverShiftSchema,
  insertGroundExecutionEventSchema,
  insertGroundOperatorSchema,
  insertGroundServiceIncidentSchema,
  insertGroundTransferPreferenceSchema,
  insertGroundVehicleSchema,
  updateGroundDispatchAssignmentSchema,
  updateGroundDispatchCheckpointSchema,
  updateGroundDispatchLegSchema,
  updateGroundDispatchPassengerSchema,
  updateGroundDispatchSchema,
  updateGroundDriverSchema,
  updateGroundDriverShiftSchema,
  updateGroundExecutionEventSchema,
  updateGroundOperatorSchema,
  updateGroundServiceIncidentSchema,
  updateGroundTransferPreferenceSchema,
  updateGroundVehicleSchema,
} from "./validation.js"
export { groundService }
