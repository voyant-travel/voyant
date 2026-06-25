import type {
  groundDispatchAssignments,
  groundDispatchCheckpoints,
  groundDispatches,
  groundDispatchLegs,
  groundDispatchPassengers,
  groundDriverShifts,
  groundDrivers,
  groundExecutionEvents,
  groundOperators,
  groundServiceIncidents,
  groundTransferPreferences,
  groundVehicles,
} from "@voyant-travel/operations/schema"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

/**
 * Response contract tests (voyant#2114 — operations ground sub-batch) for the
 * ground admin routes. Each Drizzle-backed fixture is typed as the real
 * `$inferSelect` row so column drift breaks compilation; the JSON round-trip
 * (Date → ISO string) mirrors `c.json` so a declared/actual mismatch breaks the
 * test. The schemas below mirror the response shapes declared in
 * `ground/routes.ts` (§17: timestamps/dates → strings; jsonb `metadata` is an
 * open record). No ground list endpoint joins another table, so list rows
 * carry no extra columns beyond the base `$inferSelect` shape; each list is
 * therefore asserted against the shared `{ data, total, limit, offset }`
 * envelope using the same row schema as the single `{ data }`
 * get/create/update responses.
 */

const isoTimestamp = z.string()
const jsonRecord = z.record(z.string(), z.unknown())

const listEnvelope = <T extends z.ZodTypeAny>(row: T) =>
  z.object({
    data: z.array(row),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

const operatorSchema = z.object({
  id: z.string(),
  supplierId: z.string().nullable(),
  facilityId: z.string().nullable(),
  name: z.string(),
  code: z.string().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const vehicleSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  operatorId: z.string().nullable(),
  category: z.string(),
  vehicleClass: z.string(),
  passengerCapacity: z.number().int().nullable(),
  checkedBagCapacity: z.number().int().nullable(),
  carryOnCapacity: z.number().int().nullable(),
  wheelchairCapacity: z.number().int().nullable(),
  childSeatCapacity: z.number().int().nullable(),
  isAccessible: z.boolean(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const driverSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  operatorId: z.string().nullable(),
  licenseNumber: z.string().nullable(),
  spokenLanguages: z.array(z.string()),
  isGuide: z.boolean(),
  isMeetAndGreetCapable: z.boolean(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const transferPreferenceSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  bookingItemId: z.string().nullable(),
  pickupFacilityId: z.string().nullable(),
  dropoffFacilityId: z.string().nullable(),
  pickupAddressId: z.string().nullable(),
  dropoffAddressId: z.string().nullable(),
  requestedVehicleCategory: z.string().nullable(),
  requestedVehicleClass: z.string().nullable(),
  serviceLevel: z.string(),
  passengerCount: z.number().int().nullable(),
  checkedBags: z.number().int().nullable(),
  carryOnBags: z.number().int().nullable(),
  wheelchairCount: z.number().int().nullable(),
  childSeatCount: z.number().int().nullable(),
  driverLanguage: z.string().nullable(),
  meetAndGreet: z.boolean(),
  accessibilityNotes: z.string().nullable(),
  pickupNotes: z.string().nullable(),
  dropoffNotes: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const dispatchSchema = z.object({
  id: z.string(),
  transferPreferenceId: z.string(),
  bookingId: z.string(),
  bookingItemId: z.string().nullable(),
  operatorId: z.string().nullable(),
  vehicleId: z.string().nullable(),
  driverId: z.string().nullable(),
  serviceDate: z.string().nullable(),
  scheduledPickupAt: isoTimestamp.nullable(),
  scheduledDropoffAt: isoTimestamp.nullable(),
  actualPickupAt: isoTimestamp.nullable(),
  actualDropoffAt: isoTimestamp.nullable(),
  status: z.string(),
  passengerCount: z.number().int().nullable(),
  checkedBags: z.number().int().nullable(),
  carryOnBags: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const executionEventSchema = z.object({
  id: z.string(),
  dispatchId: z.string(),
  eventType: z.string(),
  occurredAt: isoTimestamp,
  facilityId: z.string().nullable(),
  addressId: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
})

const dispatchAssignmentSchema = z.object({
  id: z.string(),
  dispatchId: z.string(),
  operatorId: z.string().nullable(),
  vehicleId: z.string().nullable(),
  driverId: z.string().nullable(),
  assignmentSource: z.string(),
  assignedAt: isoTimestamp,
  acceptedAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const dispatchLegSchema = z.object({
  id: z.string(),
  dispatchId: z.string(),
  sequence: z.number().int(),
  legType: z.string(),
  facilityId: z.string().nullable(),
  addressId: z.string().nullable(),
  scheduledAt: isoTimestamp.nullable(),
  actualAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const dispatchPassengerSchema = z.object({
  id: z.string(),
  dispatchId: z.string(),
  participantId: z.string().nullable(),
  displayName: z.string().nullable(),
  seatLabel: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const driverShiftSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  operatorId: z.string().nullable(),
  facilityId: z.string().nullable(),
  startsAt: isoTimestamp,
  endsAt: isoTimestamp,
  status: z.string(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const serviceIncidentSchema = z.object({
  id: z.string(),
  dispatchId: z.string(),
  severity: z.string(),
  incidentType: z.string(),
  resolutionStatus: z.string(),
  openedAt: isoTimestamp,
  resolvedAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const dispatchCheckpointSchema = z.object({
  id: z.string(),
  dispatchId: z.string(),
  sequence: z.number().int(),
  checkpointType: z.string(),
  status: z.string(),
  plannedAt: isoTimestamp.nullable(),
  actualAt: isoTimestamp.nullable(),
  facilityId: z.string().nullable(),
  addressId: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

// Drizzle-backed rows — typed so a column rename/retype breaks compilation.
const operatorRow: InferSelectModel<typeof groundOperators> = {
  id: "ground_operators_0000000000000000000000",
  supplierId: null,
  facilityId: null,
  name: "Acme Transfers",
  code: "ACME",
  active: true,
  notes: null,
  createdAt,
  updatedAt,
}

const vehicleRow: InferSelectModel<typeof groundVehicles> = {
  id: "ground_vehicles_00000000000000000000000",
  resourceId: "resource-1",
  operatorId: operatorRow.id,
  category: "van",
  vehicleClass: "standard",
  passengerCapacity: 8,
  checkedBagCapacity: 8,
  carryOnCapacity: 8,
  wheelchairCapacity: 0,
  childSeatCapacity: 2,
  isAccessible: false,
  active: true,
  notes: null,
  createdAt,
  updatedAt,
}

const driverRow: InferSelectModel<typeof groundDrivers> = {
  id: "ground_drivers_000000000000000000000000",
  resourceId: "resource-2",
  operatorId: operatorRow.id,
  licenseNumber: "DL-123",
  spokenLanguages: ["en", "ro"],
  isGuide: false,
  isMeetAndGreetCapable: true,
  active: true,
  notes: null,
  createdAt,
  updatedAt,
}

const transferPreferenceRow: InferSelectModel<typeof groundTransferPreferences> = {
  id: "ground_transfer_preferences_000000000000",
  bookingId: "bkg_0000000000000000000000000",
  bookingItemId: null,
  pickupFacilityId: null,
  dropoffFacilityId: null,
  pickupAddressId: null,
  dropoffAddressId: null,
  requestedVehicleCategory: "van",
  requestedVehicleClass: "standard",
  serviceLevel: "private",
  passengerCount: 2,
  checkedBags: 2,
  carryOnBags: 2,
  wheelchairCount: 0,
  childSeatCount: 0,
  driverLanguage: "en",
  meetAndGreet: true,
  accessibilityNotes: null,
  pickupNotes: null,
  dropoffNotes: null,
  notes: null,
  createdAt,
  updatedAt,
}

const dispatchRow: InferSelectModel<typeof groundDispatches> = {
  id: "ground_dispatches_00000000000000000000",
  transferPreferenceId: transferPreferenceRow.id,
  bookingId: "bkg_0000000000000000000000000",
  bookingItemId: null,
  operatorId: operatorRow.id,
  vehicleId: vehicleRow.id,
  driverId: driverRow.id,
  serviceDate: "2026-07-01",
  scheduledPickupAt: createdAt,
  scheduledDropoffAt: null,
  actualPickupAt: null,
  actualDropoffAt: null,
  status: "scheduled",
  passengerCount: 2,
  checkedBags: 2,
  carryOnBags: 2,
  notes: null,
  createdAt,
  updatedAt,
}

const executionEventRow: InferSelectModel<typeof groundExecutionEvents> = {
  id: "ground_execution_events_0000000000000000",
  dispatchId: dispatchRow.id,
  eventType: "note",
  occurredAt: createdAt,
  facilityId: null,
  addressId: null,
  notes: "checked in",
  metadata: { source: "ops" },
  createdAt,
}

const dispatchAssignmentRow: InferSelectModel<typeof groundDispatchAssignments> = {
  id: "ground_dispatch_assignments_000000000000",
  dispatchId: dispatchRow.id,
  operatorId: operatorRow.id,
  vehicleId: vehicleRow.id,
  driverId: driverRow.id,
  assignmentSource: "manual",
  assignedAt: createdAt,
  acceptedAt: null,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const dispatchLegRow: InferSelectModel<typeof groundDispatchLegs> = {
  id: "ground_dispatch_legs_0000000000000000000",
  dispatchId: dispatchRow.id,
  sequence: 0,
  legType: "pickup",
  facilityId: null,
  addressId: null,
  scheduledAt: createdAt,
  actualAt: null,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const dispatchPassengerRow: InferSelectModel<typeof groundDispatchPassengers> = {
  id: "ground_dispatch_passengers_0000000000000",
  dispatchId: dispatchRow.id,
  participantId: null,
  displayName: "Ada Lovelace",
  seatLabel: "1A",
  notes: null,
  createdAt,
  updatedAt,
}

const driverShiftRow: InferSelectModel<typeof groundDriverShifts> = {
  id: "ground_driver_shifts_0000000000000000000",
  driverId: driverRow.id,
  operatorId: operatorRow.id,
  facilityId: null,
  startsAt: createdAt,
  endsAt: updatedAt,
  status: "scheduled",
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const serviceIncidentRow: InferSelectModel<typeof groundServiceIncidents> = {
  id: "ground_service_incidents_000000000000000",
  dispatchId: dispatchRow.id,
  severity: "warning",
  incidentType: "delay",
  resolutionStatus: "open",
  openedAt: createdAt,
  resolvedAt: null,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const dispatchCheckpointRow: InferSelectModel<typeof groundDispatchCheckpoints> = {
  id: "ground_dispatch_checkpoints_000000000000",
  dispatchId: dispatchRow.id,
  sequence: 0,
  checkpointType: "airport_arrival",
  status: "pending",
  plannedAt: createdAt,
  actualAt: null,
  facilityId: null,
  addressId: null,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const pagination = { total: 1, limit: 50, offset: 0 } as const

const cases: Array<{ name: string; row: object; schema: z.ZodTypeAny }> = [
  { name: "operator", row: operatorRow, schema: operatorSchema },
  { name: "vehicle", row: vehicleRow, schema: vehicleSchema },
  { name: "driver", row: driverRow, schema: driverSchema },
  { name: "transfer preference", row: transferPreferenceRow, schema: transferPreferenceSchema },
  { name: "dispatch", row: dispatchRow, schema: dispatchSchema },
  { name: "execution event", row: executionEventRow, schema: executionEventSchema },
  {
    name: "dispatch assignment",
    row: dispatchAssignmentRow,
    schema: dispatchAssignmentSchema,
  },
  { name: "dispatch leg", row: dispatchLegRow, schema: dispatchLegSchema },
  { name: "dispatch passenger", row: dispatchPassengerRow, schema: dispatchPassengerSchema },
  { name: "driver shift", row: driverShiftRow, schema: driverShiftSchema },
  { name: "service incident", row: serviceIncidentRow, schema: serviceIncidentSchema },
  { name: "dispatch checkpoint", row: dispatchCheckpointRow, schema: dispatchCheckpointSchema },
]

describe("ground Drizzle-backed response contracts", () => {
  for (const { name, row, schema } of cases) {
    it(`the ${name} { data } envelope satisfies the declared schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })

    it(`the ${name} list envelope satisfies the declared schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: [row], ...pagination }))
      const parsed = listEnvelope(schema).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})
