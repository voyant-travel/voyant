/**
 * Ground "operated transfers" admin routes — the CRUD surfaces for the twelve
 * ground-transfer resources: operators, vehicles, drivers, transfer
 * preferences, dispatches, execution events, dispatch assignments, dispatch
 * legs, dispatch passengers, driver shifts, service incidents, and dispatch
 * checkpoints. Mounted on the legacy `/v1/operations/*` surface (operator React
 * clients hit those paths) AND, for the published OpenAPI admin contract, on the
 * staff surface at `/v1/admin/operations/*` (see `operations/routes.ts`).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * operations ground sub-batch). Request schemas reuse the exported
 * `validation.ts` insert/update/list-query schemas the handlers already parse;
 * response row schemas are authored here from the Drizzle `$inferSelect` shapes
 * (§17 dates → strings). No list endpoint joins another table, so no list row
 * carries extra columns. Each resource is its own small `OpenAPIHono` sub-chain;
 * the per-resource chains are then composed onto `groundRoutes` via `.route("/")`
 * grouped into six sub-chains so the `.openapi()` operations propagate up
 * through the parent operations registries while keeping type-inference cost
 * bounded (one flat chain has O(n²) inference cost).
 *
 * agent-quality: file-size exception — intentional: a mechanically-repetitive
 * CRUD bundle over twelve ground resources (60 legs), each with a `createRoute`
 * def + co-located handler per the established admin route pattern (mirrors
 * `availability/routes-pickups.ts`). Splitting per resource would fragment the
 * single mounted instance without aiding review. See voyant#2114.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { groundService } from "./service.js"
import {
  groundAssignmentSourceSchema,
  groundCheckpointStatusSchema,
  groundDispatchAssignmentListQuerySchema,
  groundDispatchCheckpointListQuerySchema,
  groundDispatchLegListQuerySchema,
  groundDispatchLegTypeSchema,
  groundDispatchListQuerySchema,
  groundDispatchPassengerListQuerySchema,
  groundDispatchStatusSchema,
  groundDriverListQuerySchema,
  groundDriverShiftListQuerySchema,
  groundDriverShiftStatusSchema,
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

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

// --- shared response building blocks ----------------------------------------

const errorResponseSchema = z.object({ error: z.string() })
const successResponseSchema = z.object({ success: z.literal(true) })
const idSchema = z.string()
const idParamSchema = z.object({ id: idSchema })
const isoTimestamp = z.string()
const isoDate = z.string()
const jsonRecord = z.record(z.string(), z.unknown())

/** One `application/json` "invalid request body" response entry. */
const invalidRequestResponse = {
  description: "invalid_request: request body failed validation",
  content: { "application/json": { schema: errorResponseSchema } },
} as const

const notFoundResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorResponseSchema } },
})

// §17: timestamps/dates are serialized to ISO strings on the wire.

const groundOperatorSchema = z.object({
  id: idSchema,
  supplierId: z.string().nullable(),
  facilityId: z.string().nullable(),
  name: z.string(),
  code: z.string().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const groundVehicleSchema = z.object({
  id: idSchema,
  resourceId: z.string(),
  operatorId: z.string().nullable(),
  category: groundVehicleCategorySchema,
  vehicleClass: groundVehicleClassSchema,
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

const groundDriverSchema = z.object({
  id: idSchema,
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

const groundTransferPreferenceSchema = z.object({
  id: idSchema,
  bookingId: z.string(),
  bookingItemId: z.string().nullable(),
  pickupFacilityId: z.string().nullable(),
  dropoffFacilityId: z.string().nullable(),
  pickupAddressId: z.string().nullable(),
  dropoffAddressId: z.string().nullable(),
  requestedVehicleCategory: groundVehicleCategorySchema.nullable(),
  requestedVehicleClass: groundVehicleClassSchema.nullable(),
  serviceLevel: groundServiceLevelSchema,
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

const groundDispatchSchema = z.object({
  id: idSchema,
  transferPreferenceId: z.string(),
  bookingId: z.string(),
  bookingItemId: z.string().nullable(),
  operatorId: z.string().nullable(),
  vehicleId: z.string().nullable(),
  driverId: z.string().nullable(),
  serviceDate: isoDate.nullable(),
  scheduledPickupAt: isoTimestamp.nullable(),
  scheduledDropoffAt: isoTimestamp.nullable(),
  actualPickupAt: isoTimestamp.nullable(),
  actualDropoffAt: isoTimestamp.nullable(),
  status: groundDispatchStatusSchema,
  passengerCount: z.number().int().nullable(),
  checkedBags: z.number().int().nullable(),
  carryOnBags: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const groundExecutionEventSchema = z.object({
  id: idSchema,
  dispatchId: z.string(),
  eventType: groundExecutionEventTypeSchema,
  occurredAt: isoTimestamp,
  facilityId: z.string().nullable(),
  addressId: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
})

const groundDispatchAssignmentSchema = z.object({
  id: idSchema,
  dispatchId: z.string(),
  operatorId: z.string().nullable(),
  vehicleId: z.string().nullable(),
  driverId: z.string().nullable(),
  assignmentSource: groundAssignmentSourceSchema,
  assignedAt: isoTimestamp,
  acceptedAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const groundDispatchLegSchema = z.object({
  id: idSchema,
  dispatchId: z.string(),
  sequence: z.number().int(),
  legType: groundDispatchLegTypeSchema,
  facilityId: z.string().nullable(),
  addressId: z.string().nullable(),
  scheduledAt: isoTimestamp.nullable(),
  actualAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const groundDispatchPassengerSchema = z.object({
  id: idSchema,
  dispatchId: z.string(),
  participantId: z.string().nullable(),
  displayName: z.string().nullable(),
  seatLabel: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const groundDriverShiftSchema = z.object({
  id: idSchema,
  driverId: z.string(),
  operatorId: z.string().nullable(),
  facilityId: z.string().nullable(),
  startsAt: isoTimestamp,
  endsAt: isoTimestamp,
  status: groundDriverShiftStatusSchema,
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const groundServiceIncidentSchema = z.object({
  id: idSchema,
  dispatchId: z.string(),
  severity: groundIncidentSeveritySchema,
  incidentType: z.string(),
  resolutionStatus: groundIncidentResolutionStatusSchema,
  openedAt: isoTimestamp,
  resolvedAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const groundDispatchCheckpointSchema = z.object({
  id: idSchema,
  dispatchId: z.string(),
  sequence: z.number().int(),
  checkpointType: z.string(),
  status: groundCheckpointStatusSchema,
  plannedAt: isoTimestamp.nullable(),
  actualAt: isoTimestamp.nullable(),
  facilityId: z.string().nullable(),
  addressId: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// --- operators --------------------------------------------------------------

const listOperatorsRoute = createRoute({
  method: "get",
  path: "/operators",
  request: { query: groundOperatorListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground operators",
      content: { "application/json": { schema: listResponseSchema(groundOperatorSchema) } },
    },
  },
})

const createOperatorRoute = createRoute({
  method: "post",
  path: "/operators",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundOperatorSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground operator",
      content: { "application/json": { schema: z.object({ data: groundOperatorSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const getOperatorRoute = createRoute({
  method: "get",
  path: "/operators/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground operator by id",
      content: { "application/json": { schema: z.object({ data: groundOperatorSchema }) } },
    },
    404: notFoundResponse("Ground operator not found"),
  },
})

const updateOperatorRoute = createRoute({
  method: "patch",
  path: "/operators/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundOperatorSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground operator",
      content: { "application/json": { schema: z.object({ data: groundOperatorSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground operator not found"),
  },
})

const deleteOperatorRoute = createRoute({
  method: "delete",
  path: "/operators/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground operator deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground operator not found"),
  },
})

// --- vehicles ---------------------------------------------------------------

const listVehiclesRoute = createRoute({
  method: "get",
  path: "/vehicles",
  request: { query: groundVehicleListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground vehicles",
      content: { "application/json": { schema: listResponseSchema(groundVehicleSchema) } },
    },
  },
})

const createVehicleRoute = createRoute({
  method: "post",
  path: "/vehicles",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundVehicleSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground vehicle",
      content: { "application/json": { schema: z.object({ data: groundVehicleSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const getVehicleRoute = createRoute({
  method: "get",
  path: "/vehicles/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground vehicle by id",
      content: { "application/json": { schema: z.object({ data: groundVehicleSchema }) } },
    },
    404: notFoundResponse("Ground vehicle not found"),
  },
})

const updateVehicleRoute = createRoute({
  method: "patch",
  path: "/vehicles/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundVehicleSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground vehicle",
      content: { "application/json": { schema: z.object({ data: groundVehicleSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground vehicle not found"),
  },
})

const deleteVehicleRoute = createRoute({
  method: "delete",
  path: "/vehicles/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground vehicle deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground vehicle not found"),
  },
})

const operatorVehicleRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listOperatorsRoute, async (c) =>
    c.json(await groundService.listOperators(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createOperatorRoute, async (c) => {
    const row = await groundService.createOperator(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getOperatorRoute, async (c) => {
    const row = await groundService.getOperatorById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Ground operator not found" }, 404)
  })
  .openapi(updateOperatorRoute, async (c) => {
    const row = await groundService.updateOperator(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Ground operator not found" }, 404)
  })
  .openapi(deleteOperatorRoute, async (c) => {
    const row = await groundService.deleteOperator(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground operator not found" }, 404)
  })
  .openapi(listVehiclesRoute, async (c) =>
    c.json(await groundService.listVehicles(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createVehicleRoute, async (c) => {
    const row = await groundService.createVehicle(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getVehicleRoute, async (c) => {
    const row = await groundService.getVehicleById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Ground vehicle not found" }, 404)
  })
  .openapi(updateVehicleRoute, async (c) => {
    const row = await groundService.updateVehicle(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Ground vehicle not found" }, 404)
  })
  .openapi(deleteVehicleRoute, async (c) => {
    const row = await groundService.deleteVehicle(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground vehicle not found" }, 404)
  })

// --- drivers ----------------------------------------------------------------

const listDriversRoute = createRoute({
  method: "get",
  path: "/drivers",
  request: { query: groundDriverListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground drivers",
      content: { "application/json": { schema: listResponseSchema(groundDriverSchema) } },
    },
  },
})

const createDriverRoute = createRoute({
  method: "post",
  path: "/drivers",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundDriverSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground driver",
      content: { "application/json": { schema: z.object({ data: groundDriverSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const getDriverRoute = createRoute({
  method: "get",
  path: "/drivers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground driver by id",
      content: { "application/json": { schema: z.object({ data: groundDriverSchema }) } },
    },
    404: notFoundResponse("Ground driver not found"),
  },
})

const updateDriverRoute = createRoute({
  method: "patch",
  path: "/drivers/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundDriverSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground driver",
      content: { "application/json": { schema: z.object({ data: groundDriverSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground driver not found"),
  },
})

const deleteDriverRoute = createRoute({
  method: "delete",
  path: "/drivers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground driver deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground driver not found"),
  },
})

// --- transfer preferences ---------------------------------------------------

const listTransferPreferencesRoute = createRoute({
  method: "get",
  path: "/transfer-preferences",
  request: { query: groundTransferPreferenceListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground transfer preferences",
      content: {
        "application/json": { schema: listResponseSchema(groundTransferPreferenceSchema) },
      },
    },
  },
})

const createTransferPreferenceRoute = createRoute({
  method: "post",
  path: "/transfer-preferences",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundTransferPreferenceSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground transfer preference",
      content: {
        "application/json": { schema: z.object({ data: groundTransferPreferenceSchema }) },
      },
    },
    400: invalidRequestResponse,
  },
})

const getTransferPreferenceRoute = createRoute({
  method: "get",
  path: "/transfer-preferences/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground transfer preference by id",
      content: {
        "application/json": { schema: z.object({ data: groundTransferPreferenceSchema }) },
      },
    },
    404: notFoundResponse("Ground transfer preference not found"),
  },
})

const updateTransferPreferenceRoute = createRoute({
  method: "patch",
  path: "/transfer-preferences/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundTransferPreferenceSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground transfer preference",
      content: {
        "application/json": { schema: z.object({ data: groundTransferPreferenceSchema }) },
      },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground transfer preference not found"),
  },
})

const deleteTransferPreferenceRoute = createRoute({
  method: "delete",
  path: "/transfer-preferences/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground transfer preference deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground transfer preference not found"),
  },
})

const driverPreferenceRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listDriversRoute, async (c) =>
    c.json(await groundService.listDrivers(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createDriverRoute, async (c) => {
    const row = await groundService.createDriver(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getDriverRoute, async (c) => {
    const row = await groundService.getDriverById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Ground driver not found" }, 404)
  })
  .openapi(updateDriverRoute, async (c) => {
    const row = await groundService.updateDriver(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Ground driver not found" }, 404)
  })
  .openapi(deleteDriverRoute, async (c) => {
    const row = await groundService.deleteDriver(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground driver not found" }, 404)
  })
  .openapi(listTransferPreferencesRoute, async (c) =>
    c.json(await groundService.listTransferPreferences(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createTransferPreferenceRoute, async (c) => {
    const row = await groundService.createTransferPreference(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getTransferPreferenceRoute, async (c) => {
    const row = await groundService.getTransferPreferenceById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground transfer preference not found" }, 404)
  })
  .openapi(updateTransferPreferenceRoute, async (c) => {
    const row = await groundService.updateTransferPreference(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground transfer preference not found" }, 404)
  })
  .openapi(deleteTransferPreferenceRoute, async (c) => {
    const row = await groundService.deleteTransferPreference(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground transfer preference not found" }, 404)
  })

// --- dispatches -------------------------------------------------------------

const listDispatchesRoute = createRoute({
  method: "get",
  path: "/dispatches",
  request: { query: groundDispatchListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground dispatches",
      content: { "application/json": { schema: listResponseSchema(groundDispatchSchema) } },
    },
  },
})

const createDispatchRoute = createRoute({
  method: "post",
  path: "/dispatches",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundDispatchSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground dispatch",
      content: { "application/json": { schema: z.object({ data: groundDispatchSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const getDispatchRoute = createRoute({
  method: "get",
  path: "/dispatches/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground dispatch by id",
      content: { "application/json": { schema: z.object({ data: groundDispatchSchema }) } },
    },
    404: notFoundResponse("Ground dispatch not found"),
  },
})

const updateDispatchRoute = createRoute({
  method: "patch",
  path: "/dispatches/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundDispatchSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground dispatch",
      content: { "application/json": { schema: z.object({ data: groundDispatchSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground dispatch not found"),
  },
})

const deleteDispatchRoute = createRoute({
  method: "delete",
  path: "/dispatches/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground dispatch deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground dispatch not found"),
  },
})

// --- execution events -------------------------------------------------------

const listExecutionEventsRoute = createRoute({
  method: "get",
  path: "/execution-events",
  request: { query: groundExecutionEventListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground execution events",
      content: { "application/json": { schema: listResponseSchema(groundExecutionEventSchema) } },
    },
  },
})

const createExecutionEventRoute = createRoute({
  method: "post",
  path: "/execution-events",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundExecutionEventSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground execution event",
      content: { "application/json": { schema: z.object({ data: groundExecutionEventSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const getExecutionEventRoute = createRoute({
  method: "get",
  path: "/execution-events/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground execution event by id",
      content: { "application/json": { schema: z.object({ data: groundExecutionEventSchema }) } },
    },
    404: notFoundResponse("Ground execution event not found"),
  },
})

const updateExecutionEventRoute = createRoute({
  method: "patch",
  path: "/execution-events/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundExecutionEventSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground execution event",
      content: { "application/json": { schema: z.object({ data: groundExecutionEventSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground execution event not found"),
  },
})

const deleteExecutionEventRoute = createRoute({
  method: "delete",
  path: "/execution-events/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground execution event deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground execution event not found"),
  },
})

const dispatchEventRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listDispatchesRoute, async (c) =>
    c.json(await groundService.listDispatches(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createDispatchRoute, async (c) => {
    const row = await groundService.createDispatch(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getDispatchRoute, async (c) => {
    const row = await groundService.getDispatchById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Ground dispatch not found" }, 404)
  })
  .openapi(updateDispatchRoute, async (c) => {
    const row = await groundService.updateDispatch(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Ground dispatch not found" }, 404)
  })
  .openapi(deleteDispatchRoute, async (c) => {
    const row = await groundService.deleteDispatch(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground dispatch not found" }, 404)
  })
  .openapi(listExecutionEventsRoute, async (c) =>
    c.json(await groundService.listExecutionEvents(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createExecutionEventRoute, async (c) => {
    const row = await groundService.createExecutionEvent(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getExecutionEventRoute, async (c) => {
    const row = await groundService.getExecutionEventById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground execution event not found" }, 404)
  })
  .openapi(updateExecutionEventRoute, async (c) => {
    const row = await groundService.updateExecutionEvent(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground execution event not found" }, 404)
  })
  .openapi(deleteExecutionEventRoute, async (c) => {
    const row = await groundService.deleteExecutionEvent(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground execution event not found" }, 404)
  })

// --- dispatch assignments ---------------------------------------------------

const listDispatchAssignmentsRoute = createRoute({
  method: "get",
  path: "/dispatch-assignments",
  request: { query: groundDispatchAssignmentListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground dispatch assignments",
      content: {
        "application/json": { schema: listResponseSchema(groundDispatchAssignmentSchema) },
      },
    },
  },
})

const createDispatchAssignmentRoute = createRoute({
  method: "post",
  path: "/dispatch-assignments",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundDispatchAssignmentSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground dispatch assignment",
      content: {
        "application/json": { schema: z.object({ data: groundDispatchAssignmentSchema }) },
      },
    },
    400: invalidRequestResponse,
  },
})

const getDispatchAssignmentRoute = createRoute({
  method: "get",
  path: "/dispatch-assignments/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground dispatch assignment by id",
      content: {
        "application/json": { schema: z.object({ data: groundDispatchAssignmentSchema }) },
      },
    },
    404: notFoundResponse("Ground dispatch assignment not found"),
  },
})

const updateDispatchAssignmentRoute = createRoute({
  method: "patch",
  path: "/dispatch-assignments/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundDispatchAssignmentSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground dispatch assignment",
      content: {
        "application/json": { schema: z.object({ data: groundDispatchAssignmentSchema }) },
      },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground dispatch assignment not found"),
  },
})

const deleteDispatchAssignmentRoute = createRoute({
  method: "delete",
  path: "/dispatch-assignments/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground dispatch assignment deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground dispatch assignment not found"),
  },
})

// --- dispatch legs ----------------------------------------------------------

const listDispatchLegsRoute = createRoute({
  method: "get",
  path: "/dispatch-legs",
  request: { query: groundDispatchLegListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground dispatch legs",
      content: { "application/json": { schema: listResponseSchema(groundDispatchLegSchema) } },
    },
  },
})

const createDispatchLegRoute = createRoute({
  method: "post",
  path: "/dispatch-legs",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundDispatchLegSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground dispatch leg",
      content: { "application/json": { schema: z.object({ data: groundDispatchLegSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const getDispatchLegRoute = createRoute({
  method: "get",
  path: "/dispatch-legs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground dispatch leg by id",
      content: { "application/json": { schema: z.object({ data: groundDispatchLegSchema }) } },
    },
    404: notFoundResponse("Ground dispatch leg not found"),
  },
})

const updateDispatchLegRoute = createRoute({
  method: "patch",
  path: "/dispatch-legs/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundDispatchLegSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground dispatch leg",
      content: { "application/json": { schema: z.object({ data: groundDispatchLegSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground dispatch leg not found"),
  },
})

const deleteDispatchLegRoute = createRoute({
  method: "delete",
  path: "/dispatch-legs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground dispatch leg deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground dispatch leg not found"),
  },
})

const assignmentLegRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listDispatchAssignmentsRoute, async (c) =>
    c.json(await groundService.listDispatchAssignments(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createDispatchAssignmentRoute, async (c) => {
    const row = await groundService.createDispatchAssignment(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getDispatchAssignmentRoute, async (c) => {
    const row = await groundService.getDispatchAssignmentById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground dispatch assignment not found" }, 404)
  })
  .openapi(updateDispatchAssignmentRoute, async (c) => {
    const row = await groundService.updateDispatchAssignment(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground dispatch assignment not found" }, 404)
  })
  .openapi(deleteDispatchAssignmentRoute, async (c) => {
    const row = await groundService.deleteDispatchAssignment(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground dispatch assignment not found" }, 404)
  })
  .openapi(listDispatchLegsRoute, async (c) =>
    c.json(await groundService.listDispatchLegs(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createDispatchLegRoute, async (c) => {
    const row = await groundService.createDispatchLeg(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getDispatchLegRoute, async (c) => {
    const row = await groundService.getDispatchLegById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground dispatch leg not found" }, 404)
  })
  .openapi(updateDispatchLegRoute, async (c) => {
    const row = await groundService.updateDispatchLeg(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground dispatch leg not found" }, 404)
  })
  .openapi(deleteDispatchLegRoute, async (c) => {
    const row = await groundService.deleteDispatchLeg(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground dispatch leg not found" }, 404)
  })

// --- dispatch passengers ----------------------------------------------------

const listDispatchPassengersRoute = createRoute({
  method: "get",
  path: "/dispatch-passengers",
  request: { query: groundDispatchPassengerListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground dispatch passengers",
      content: {
        "application/json": { schema: listResponseSchema(groundDispatchPassengerSchema) },
      },
    },
  },
})

const createDispatchPassengerRoute = createRoute({
  method: "post",
  path: "/dispatch-passengers",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundDispatchPassengerSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground dispatch passenger",
      content: {
        "application/json": { schema: z.object({ data: groundDispatchPassengerSchema }) },
      },
    },
    400: invalidRequestResponse,
  },
})

const getDispatchPassengerRoute = createRoute({
  method: "get",
  path: "/dispatch-passengers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground dispatch passenger by id",
      content: {
        "application/json": { schema: z.object({ data: groundDispatchPassengerSchema }) },
      },
    },
    404: notFoundResponse("Ground dispatch passenger not found"),
  },
})

const updateDispatchPassengerRoute = createRoute({
  method: "patch",
  path: "/dispatch-passengers/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundDispatchPassengerSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground dispatch passenger",
      content: {
        "application/json": { schema: z.object({ data: groundDispatchPassengerSchema }) },
      },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground dispatch passenger not found"),
  },
})

const deleteDispatchPassengerRoute = createRoute({
  method: "delete",
  path: "/dispatch-passengers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground dispatch passenger deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground dispatch passenger not found"),
  },
})

// --- driver shifts ----------------------------------------------------------

const listDriverShiftsRoute = createRoute({
  method: "get",
  path: "/driver-shifts",
  request: { query: groundDriverShiftListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground driver shifts",
      content: { "application/json": { schema: listResponseSchema(groundDriverShiftSchema) } },
    },
  },
})

const createDriverShiftRoute = createRoute({
  method: "post",
  path: "/driver-shifts",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundDriverShiftSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground driver shift",
      content: { "application/json": { schema: z.object({ data: groundDriverShiftSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const getDriverShiftRoute = createRoute({
  method: "get",
  path: "/driver-shifts/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground driver shift by id",
      content: { "application/json": { schema: z.object({ data: groundDriverShiftSchema }) } },
    },
    404: notFoundResponse("Ground driver shift not found"),
  },
})

const updateDriverShiftRoute = createRoute({
  method: "patch",
  path: "/driver-shifts/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundDriverShiftSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground driver shift",
      content: { "application/json": { schema: z.object({ data: groundDriverShiftSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground driver shift not found"),
  },
})

const deleteDriverShiftRoute = createRoute({
  method: "delete",
  path: "/driver-shifts/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground driver shift deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground driver shift not found"),
  },
})

const passengerShiftRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listDispatchPassengersRoute, async (c) =>
    c.json(await groundService.listDispatchPassengers(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createDispatchPassengerRoute, async (c) => {
    const row = await groundService.createDispatchPassenger(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getDispatchPassengerRoute, async (c) => {
    const row = await groundService.getDispatchPassengerById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground dispatch passenger not found" }, 404)
  })
  .openapi(updateDispatchPassengerRoute, async (c) => {
    const row = await groundService.updateDispatchPassenger(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground dispatch passenger not found" }, 404)
  })
  .openapi(deleteDispatchPassengerRoute, async (c) => {
    const row = await groundService.deleteDispatchPassenger(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground dispatch passenger not found" }, 404)
  })
  .openapi(listDriverShiftsRoute, async (c) =>
    c.json(await groundService.listDriverShifts(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createDriverShiftRoute, async (c) => {
    const row = await groundService.createDriverShift(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getDriverShiftRoute, async (c) => {
    const row = await groundService.getDriverShiftById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground driver shift not found" }, 404)
  })
  .openapi(updateDriverShiftRoute, async (c) => {
    const row = await groundService.updateDriverShift(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground driver shift not found" }, 404)
  })
  .openapi(deleteDriverShiftRoute, async (c) => {
    const row = await groundService.deleteDriverShift(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground driver shift not found" }, 404)
  })

// --- service incidents ------------------------------------------------------

const listServiceIncidentsRoute = createRoute({
  method: "get",
  path: "/service-incidents",
  request: { query: groundServiceIncidentListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground service incidents",
      content: { "application/json": { schema: listResponseSchema(groundServiceIncidentSchema) } },
    },
  },
})

const createServiceIncidentRoute = createRoute({
  method: "post",
  path: "/service-incidents",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundServiceIncidentSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground service incident",
      content: { "application/json": { schema: z.object({ data: groundServiceIncidentSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const getServiceIncidentRoute = createRoute({
  method: "get",
  path: "/service-incidents/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground service incident by id",
      content: { "application/json": { schema: z.object({ data: groundServiceIncidentSchema }) } },
    },
    404: notFoundResponse("Ground service incident not found"),
  },
})

const updateServiceIncidentRoute = createRoute({
  method: "patch",
  path: "/service-incidents/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundServiceIncidentSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground service incident",
      content: { "application/json": { schema: z.object({ data: groundServiceIncidentSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground service incident not found"),
  },
})

const deleteServiceIncidentRoute = createRoute({
  method: "delete",
  path: "/service-incidents/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground service incident deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground service incident not found"),
  },
})

// --- dispatch checkpoints ---------------------------------------------------

const listDispatchCheckpointsRoute = createRoute({
  method: "get",
  path: "/dispatch-checkpoints",
  request: { query: groundDispatchCheckpointListQuerySchema },
  responses: {
    200: {
      description: "Paginated ground dispatch checkpoints",
      content: {
        "application/json": { schema: listResponseSchema(groundDispatchCheckpointSchema) },
      },
    },
  },
})

const createDispatchCheckpointRoute = createRoute({
  method: "post",
  path: "/dispatch-checkpoints",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertGroundDispatchCheckpointSchema } },
    },
  },
  responses: {
    201: {
      description: "The created ground dispatch checkpoint",
      content: {
        "application/json": { schema: z.object({ data: groundDispatchCheckpointSchema }) },
      },
    },
    400: invalidRequestResponse,
  },
})

const getDispatchCheckpointRoute = createRoute({
  method: "get",
  path: "/dispatch-checkpoints/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A ground dispatch checkpoint by id",
      content: {
        "application/json": { schema: z.object({ data: groundDispatchCheckpointSchema }) },
      },
    },
    404: notFoundResponse("Ground dispatch checkpoint not found"),
  },
})

const updateDispatchCheckpointRoute = createRoute({
  method: "patch",
  path: "/dispatch-checkpoints/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateGroundDispatchCheckpointSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated ground dispatch checkpoint",
      content: {
        "application/json": { schema: z.object({ data: groundDispatchCheckpointSchema }) },
      },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Ground dispatch checkpoint not found"),
  },
})

const deleteDispatchCheckpointRoute = createRoute({
  method: "delete",
  path: "/dispatch-checkpoints/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Ground dispatch checkpoint deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Ground dispatch checkpoint not found"),
  },
})

const incidentCheckpointRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listServiceIncidentsRoute, async (c) =>
    c.json(await groundService.listServiceIncidents(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createServiceIncidentRoute, async (c) => {
    const row = await groundService.createServiceIncident(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getServiceIncidentRoute, async (c) => {
    const row = await groundService.getServiceIncidentById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground service incident not found" }, 404)
  })
  .openapi(updateServiceIncidentRoute, async (c) => {
    const row = await groundService.updateServiceIncident(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground service incident not found" }, 404)
  })
  .openapi(deleteServiceIncidentRoute, async (c) => {
    const row = await groundService.deleteServiceIncident(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground service incident not found" }, 404)
  })
  .openapi(listDispatchCheckpointsRoute, async (c) =>
    c.json(await groundService.listDispatchCheckpoints(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createDispatchCheckpointRoute, async (c) => {
    const row = await groundService.createDispatchCheckpoint(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getDispatchCheckpointRoute, async (c) => {
    const row = await groundService.getDispatchCheckpointById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground dispatch checkpoint not found" }, 404)
  })
  .openapi(updateDispatchCheckpointRoute, async (c) => {
    const row = await groundService.updateDispatchCheckpoint(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Ground dispatch checkpoint not found" }, 404)
  })
  .openapi(deleteDispatchCheckpointRoute, async (c) => {
    const row = await groundService.deleteDispatchCheckpoint(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Ground dispatch checkpoint not found" }, 404)
  })

/**
 * Compose the per-resource sub-chains onto a single `OpenAPIHono` so the
 * `.openapi()` operations propagate up through the parent operations registries
 * (`OpenAPIHono.route` copies the sub-app's registered routes). Grouped into six
 * sub-chains of ten legs each to keep type-inference cost bounded.
 */
export const groundRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", operatorVehicleRoutes)
  .route("/", driverPreferenceRoutes)
  .route("/", dispatchEventRoutes)
  .route("/", assignmentLegRoutes)
  .route("/", passengerShiftRoutes)
  .route("/", incidentCheckpointRoutes)

export type GroundRoutes = typeof groundRoutes
