import { booleanQueryParam } from "@voyantjs/db/helpers"
import { z } from "zod"

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const groundVehicleCategorySchema = z.enum([
  "car",
  "sedan",
  "suv",
  "van",
  "minibus",
  "bus",
  "boat",
  "train",
  "other",
])

export const groundVehicleClassSchema = z.enum([
  "economy",
  "standard",
  "premium",
  "luxury",
  "accessible",
  "other",
])

export const groundServiceLevelSchema = z.enum(["private", "shared", "vip", "shuttle", "other"])
export const groundDispatchStatusSchema = z.enum([
  "draft",
  "scheduled",
  "assigned",
  "en_route",
  "arrived",
  "picked_up",
  "completed",
  "cancelled",
  "no_show",
])
export const groundExecutionEventTypeSchema = z.enum([
  "scheduled",
  "assigned",
  "driver_en_route",
  "driver_arrived",
  "pickup_completed",
  "dropoff_completed",
  "cancelled",
  "issue",
  "note",
])
export const groundAssignmentSourceSchema = z.enum(["manual", "suggested", "auto"])
export const groundDispatchLegTypeSchema = z.enum(["pickup", "stop", "dropoff", "deadhead"])
export const groundDriverShiftStatusSchema = z.enum([
  "scheduled",
  "available",
  "on_duty",
  "completed",
  "cancelled",
])
export const groundIncidentSeveritySchema = z.enum(["info", "warning", "critical"])
export const groundIncidentResolutionStatusSchema = z.enum([
  "open",
  "mitigated",
  "resolved",
  "cancelled",
])
export const groundCheckpointStatusSchema = z.enum(["pending", "reached", "missed", "cancelled"])
const isoDateSchema = z.string().date()
const isoDateTimeSchema = z.string().datetime()

const groundOperatorCoreSchema = z.object({
  supplierId: z.string().nullable().optional(),
  facilityId: z.string().nullable().optional(),
  name: z.string().min(1).max(255),
  code: z.string().max(100).nullable().optional(),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})

const groundVehicleCoreSchema = z.object({
  resourceId: z.string(),
  operatorId: z.string().nullable().optional(),
  category: groundVehicleCategorySchema.default("other"),
  vehicleClass: groundVehicleClassSchema.default("standard"),
  passengerCapacity: z.number().int().min(0).nullable().optional(),
  checkedBagCapacity: z.number().int().min(0).nullable().optional(),
  carryOnCapacity: z.number().int().min(0).nullable().optional(),
  wheelchairCapacity: z.number().int().min(0).nullable().optional(),
  childSeatCapacity: z.number().int().min(0).nullable().optional(),
  isAccessible: z.boolean().default(false),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})

const groundDriverCoreSchema = z.object({
  resourceId: z.string(),
  operatorId: z.string().nullable().optional(),
  licenseNumber: z.string().max(100).nullable().optional(),
  spokenLanguages: z.array(z.string().min(2).max(35)).default([]),
  isGuide: z.boolean().default(false),
  isMeetAndGreetCapable: z.boolean().default(false),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})

const groundTransferPreferenceCoreSchema = z.object({
  bookingId: z.string(),
  bookingItemId: z.string().nullable().optional(),
  pickupFacilityId: z.string().nullable().optional(),
  dropoffFacilityId: z.string().nullable().optional(),
  pickupAddressId: z.string().nullable().optional(),
  dropoffAddressId: z.string().nullable().optional(),
  requestedVehicleCategory: groundVehicleCategorySchema.nullable().optional(),
  requestedVehicleClass: groundVehicleClassSchema.nullable().optional(),
  serviceLevel: groundServiceLevelSchema.default("private"),
  passengerCount: z.number().int().min(0).nullable().optional(),
  checkedBags: z.number().int().min(0).nullable().optional(),
  carryOnBags: z.number().int().min(0).nullable().optional(),
  wheelchairCount: z.number().int().min(0).nullable().optional(),
  childSeatCount: z.number().int().min(0).nullable().optional(),
  driverLanguage: z.string().max(35).nullable().optional(),
  meetAndGreet: z.boolean().default(false),
  accessibilityNotes: z.string().nullable().optional(),
  pickupNotes: z.string().nullable().optional(),
  dropoffNotes: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const groundDispatchCoreSchema = z.object({
  transferPreferenceId: z.string(),
  bookingId: z.string(),
  bookingItemId: z.string().nullable().optional(),
  operatorId: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  driverId: z.string().nullable().optional(),
  serviceDate: isoDateSchema.nullable().optional(),
  scheduledPickupAt: isoDateTimeSchema.nullable().optional(),
  scheduledDropoffAt: isoDateTimeSchema.nullable().optional(),
  actualPickupAt: isoDateTimeSchema.nullable().optional(),
  actualDropoffAt: isoDateTimeSchema.nullable().optional(),
  status: groundDispatchStatusSchema.default("draft"),
  passengerCount: z.number().int().min(0).nullable().optional(),
  checkedBags: z.number().int().min(0).nullable().optional(),
  carryOnBags: z.number().int().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
})

const groundExecutionEventCoreSchema = z.object({
  dispatchId: z.string(),
  eventType: groundExecutionEventTypeSchema.default("note"),
  occurredAt: isoDateTimeSchema.nullable().optional(),
  facilityId: z.string().nullable().optional(),
  addressId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const groundDispatchAssignmentCoreSchema = z.object({
  dispatchId: z.string(),
  operatorId: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  driverId: z.string().nullable().optional(),
  assignmentSource: groundAssignmentSourceSchema.default("manual"),
  assignedAt: isoDateTimeSchema.nullable().optional(),
  acceptedAt: isoDateTimeSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const groundDispatchLegCoreSchema = z.object({
  dispatchId: z.string(),
  sequence: z.number().int().min(0).default(0),
  legType: groundDispatchLegTypeSchema.default("pickup"),
  facilityId: z.string().nullable().optional(),
  addressId: z.string().nullable().optional(),
  scheduledAt: isoDateTimeSchema.nullable().optional(),
  actualAt: isoDateTimeSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const groundDispatchPassengerCoreSchema = z.object({
  dispatchId: z.string(),
  participantId: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  seatLabel: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const groundDriverShiftCoreSchema = z.object({
  driverId: z.string(),
  operatorId: z.string().nullable().optional(),
  facilityId: z.string().nullable().optional(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  status: groundDriverShiftStatusSchema.default("scheduled"),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const groundServiceIncidentCoreSchema = z.object({
  dispatchId: z.string(),
  severity: groundIncidentSeveritySchema.default("warning"),
  incidentType: z.string().min(1),
  resolutionStatus: groundIncidentResolutionStatusSchema.default("open"),
  openedAt: isoDateTimeSchema.nullable().optional(),
  resolvedAt: isoDateTimeSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const groundDispatchCheckpointCoreSchema = z.object({
  dispatchId: z.string(),
  sequence: z.number().int().min(0).default(0),
  checkpointType: z.string().min(1),
  status: groundCheckpointStatusSchema.default("pending"),
  plannedAt: isoDateTimeSchema.nullable().optional(),
  actualAt: isoDateTimeSchema.nullable().optional(),
  facilityId: z.string().nullable().optional(),
  addressId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertGroundOperatorSchema = groundOperatorCoreSchema
export const updateGroundOperatorSchema = groundOperatorCoreSchema.partial()
export const groundOperatorListQuerySchema = paginationSchema.extend({
  supplierId: z.string().optional(),
  facilityId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export const insertGroundVehicleSchema = groundVehicleCoreSchema
export const updateGroundVehicleSchema = groundVehicleCoreSchema.partial()
export const groundVehicleListQuerySchema = paginationSchema.extend({
  resourceId: z.string().optional(),
  operatorId: z.string().optional(),
  category: groundVehicleCategorySchema.optional(),
  active: booleanQueryParam.optional(),
})

export const insertGroundDriverSchema = groundDriverCoreSchema
export const updateGroundDriverSchema = groundDriverCoreSchema.partial()
export const groundDriverListQuerySchema = paginationSchema.extend({
  resourceId: z.string().optional(),
  operatorId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export const insertGroundTransferPreferenceSchema = groundTransferPreferenceCoreSchema
export const updateGroundTransferPreferenceSchema = groundTransferPreferenceCoreSchema.partial()
export const groundTransferPreferenceListQuerySchema = paginationSchema.extend({
  bookingId: z.string().optional(),
  bookingItemId: z.string().optional(),
  serviceLevel: groundServiceLevelSchema.optional(),
})

export const insertGroundDispatchSchema = groundDispatchCoreSchema
export const updateGroundDispatchSchema = groundDispatchCoreSchema.partial()
export const groundDispatchListQuerySchema = paginationSchema.extend({
  transferPreferenceId: z.string().optional(),
  bookingId: z.string().optional(),
  bookingItemId: z.string().optional(),
  operatorId: z.string().optional(),
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  status: groundDispatchStatusSchema.optional(),
  serviceDate: isoDateSchema.optional(),
})

export const insertGroundExecutionEventSchema = groundExecutionEventCoreSchema
export const updateGroundExecutionEventSchema = groundExecutionEventCoreSchema.partial()
export const groundExecutionEventListQuerySchema = paginationSchema.extend({
  dispatchId: z.string().optional(),
  eventType: groundExecutionEventTypeSchema.optional(),
})

export const insertGroundDispatchAssignmentSchema = groundDispatchAssignmentCoreSchema
export const updateGroundDispatchAssignmentSchema = groundDispatchAssignmentCoreSchema.partial()
export const groundDispatchAssignmentListQuerySchema = paginationSchema.extend({
  dispatchId: z.string().optional(),
  operatorId: z.string().optional(),
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  assignmentSource: groundAssignmentSourceSchema.optional(),
})

export const insertGroundDispatchLegSchema = groundDispatchLegCoreSchema
export const updateGroundDispatchLegSchema = groundDispatchLegCoreSchema.partial()
export const groundDispatchLegListQuerySchema = paginationSchema.extend({
  dispatchId: z.string().optional(),
  legType: groundDispatchLegTypeSchema.optional(),
})

export const insertGroundDispatchPassengerSchema = groundDispatchPassengerCoreSchema
export const updateGroundDispatchPassengerSchema = groundDispatchPassengerCoreSchema.partial()
export const groundDispatchPassengerListQuerySchema = paginationSchema.extend({
  dispatchId: z.string().optional(),
  participantId: z.string().optional(),
})

export const insertGroundDriverShiftSchema = groundDriverShiftCoreSchema
export const updateGroundDriverShiftSchema = groundDriverShiftCoreSchema.partial()
export const groundDriverShiftListQuerySchema = paginationSchema.extend({
  driverId: z.string().optional(),
  operatorId: z.string().optional(),
  facilityId: z.string().optional(),
  status: groundDriverShiftStatusSchema.optional(),
})

export const insertGroundServiceIncidentSchema = groundServiceIncidentCoreSchema
export const updateGroundServiceIncidentSchema = groundServiceIncidentCoreSchema.partial()
export const groundServiceIncidentListQuerySchema = paginationSchema.extend({
  dispatchId: z.string().optional(),
  severity: groundIncidentSeveritySchema.optional(),
  resolutionStatus: groundIncidentResolutionStatusSchema.optional(),
})

export const insertGroundDispatchCheckpointSchema = groundDispatchCheckpointCoreSchema
export const updateGroundDispatchCheckpointSchema = groundDispatchCheckpointCoreSchema.partial()
export const groundDispatchCheckpointListQuerySchema = paginationSchema.extend({
  dispatchId: z.string().optional(),
  status: groundCheckpointStatusSchema.optional(),
})
