import { identityAddresses } from "@voyantjs/identity/schema"
import { relations } from "drizzle-orm"

import { groundDispatches, groundTransferPreferences } from "./schema-dispatch.js"
import {
  groundDispatchAssignments,
  groundDispatchCheckpoints,
  groundDispatchLegs,
  groundDispatchPassengers,
  groundDriverShifts,
  groundExecutionEvents,
  groundServiceIncidents,
} from "./schema-operations.js"
import { groundDrivers, groundOperators, groundVehicles } from "./schema-operators.js"

export const groundOperatorsRelations = relations(groundOperators, ({ many }) => ({
  vehicles: many(groundVehicles),
  drivers: many(groundDrivers),
}))

export const groundVehiclesRelations = relations(groundVehicles, ({ one }) => ({
  operator: one(groundOperators, {
    fields: [groundVehicles.operatorId],
    references: [groundOperators.id],
  }),
}))

export const groundDriversRelations = relations(groundDrivers, ({ one }) => ({
  operator: one(groundOperators, {
    fields: [groundDrivers.operatorId],
    references: [groundOperators.id],
  }),
}))

export const groundTransferPreferencesRelations = relations(
  groundTransferPreferences,
  ({ one, many }) => ({
    pickupAddress: one(identityAddresses, {
      fields: [groundTransferPreferences.pickupAddressId],
      references: [identityAddresses.id],
    }),
    dropoffAddress: one(identityAddresses, {
      fields: [groundTransferPreferences.dropoffAddressId],
      references: [identityAddresses.id],
    }),
    dispatches: many(groundDispatches),
  }),
)

export const groundDispatchesRelations = relations(groundDispatches, ({ one, many }) => ({
  transferPreference: one(groundTransferPreferences, {
    fields: [groundDispatches.transferPreferenceId],
    references: [groundTransferPreferences.id],
  }),
  operator: one(groundOperators, {
    fields: [groundDispatches.operatorId],
    references: [groundOperators.id],
  }),
  vehicle: one(groundVehicles, {
    fields: [groundDispatches.vehicleId],
    references: [groundVehicles.id],
  }),
  driver: one(groundDrivers, {
    fields: [groundDispatches.driverId],
    references: [groundDrivers.id],
  }),
  executionEvents: many(groundExecutionEvents),
  assignments: many(groundDispatchAssignments),
  legs: many(groundDispatchLegs),
  passengers: many(groundDispatchPassengers),
  incidents: many(groundServiceIncidents),
  checkpoints: many(groundDispatchCheckpoints),
}))

export const groundExecutionEventsRelations = relations(groundExecutionEvents, ({ one }) => ({
  dispatch: one(groundDispatches, {
    fields: [groundExecutionEvents.dispatchId],
    references: [groundDispatches.id],
  }),
  address: one(identityAddresses, {
    fields: [groundExecutionEvents.addressId],
    references: [identityAddresses.id],
  }),
}))

export const groundDispatchAssignmentsRelations = relations(
  groundDispatchAssignments,
  ({ one }) => ({
    dispatch: one(groundDispatches, {
      fields: [groundDispatchAssignments.dispatchId],
      references: [groundDispatches.id],
    }),
    operator: one(groundOperators, {
      fields: [groundDispatchAssignments.operatorId],
      references: [groundOperators.id],
    }),
    vehicle: one(groundVehicles, {
      fields: [groundDispatchAssignments.vehicleId],
      references: [groundVehicles.id],
    }),
    driver: one(groundDrivers, {
      fields: [groundDispatchAssignments.driverId],
      references: [groundDrivers.id],
    }),
  }),
)

export const groundDispatchLegsRelations = relations(groundDispatchLegs, ({ one }) => ({
  dispatch: one(groundDispatches, {
    fields: [groundDispatchLegs.dispatchId],
    references: [groundDispatches.id],
  }),
  address: one(identityAddresses, {
    fields: [groundDispatchLegs.addressId],
    references: [identityAddresses.id],
  }),
}))

export const groundDispatchPassengersRelations = relations(groundDispatchPassengers, ({ one }) => ({
  dispatch: one(groundDispatches, {
    fields: [groundDispatchPassengers.dispatchId],
    references: [groundDispatches.id],
  }),
}))

export const groundDriverShiftsRelations = relations(groundDriverShifts, ({ one }) => ({
  driver: one(groundDrivers, {
    fields: [groundDriverShifts.driverId],
    references: [groundDrivers.id],
  }),
  operator: one(groundOperators, {
    fields: [groundDriverShifts.operatorId],
    references: [groundOperators.id],
  }),
}))

export const groundServiceIncidentsRelations = relations(groundServiceIncidents, ({ one }) => ({
  dispatch: one(groundDispatches, {
    fields: [groundServiceIncidents.dispatchId],
    references: [groundDispatches.id],
  }),
}))

export const groundDispatchCheckpointsRelations = relations(
  groundDispatchCheckpoints,
  ({ one }) => ({
    dispatch: one(groundDispatches, {
      fields: [groundDispatchCheckpoints.dispatchId],
      references: [groundDispatches.id],
    }),
    address: one(identityAddresses, {
      fields: [groundDispatchCheckpoints.addressId],
      references: [identityAddresses.id],
    }),
  }),
)
