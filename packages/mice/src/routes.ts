/**
 * agent-quality: file-size exception -- owner: mice; the MICE OpenAPI route
 * definitions and handlers stay co-located until a dedicated route split
 * preserves generated OpenAPI output and coverage.
 *
 * MICE program admin routes. Mounted by the deployment under `/v1/admin/mice`.
 * Routes stay thin: validate, call the domain services, serialize. See RFC
 * voyant#1489.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * mice sub-batch). Request schemas reuse the exported `validation*.ts` schemas
 * the handlers already parse; response row schemas are authored here from the
 * Drizzle `$inferSelect` shapes (§17: `date`/timestamp columns serialize to
 * ISO strings over the wire; integer fields stay numbers). The MICE list
 * services return `{ data, limit, offset }` (no `total` count read), so the
 * list envelope is declared locally rather than via `listResponseSchema`. The
 * single-resource GET legs return the base row extended with the joined child
 * collections (`inclusions`, `enrollments`, `delegates`, `invitations`/`bids`,
 * `lines`/`evaluations`). Typed service-outcome → HTTP-status unions are
 * declared inline per leg.
 *
 * Each resource is its own small `OpenAPIHono` sub-chain composed onto
 * `miceAdminRoutes` via `.route("/", child)` so the `.openapi()` operations
 * propagate up while keeping type-inference cost bounded (one flat chain has
 * O(n²) inference cost). Within each child, static/collection paths are
 * registered before dynamic `/{id}` legs.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { MiceRouteRuntime } from "./route-runtime.js"
import { createProgram, getProgram, listPrograms, updateProgram } from "./service.js"
import { commercialsService } from "./service-commercials.js"
import {
  createDelegate,
  enrollDelegate,
  getDelegate,
  listDelegates,
  updateDelegate,
} from "./service-delegates.js"
import { rfpService } from "./service-rfp.js"
import {
  createRoomingAssignment,
  getRoomingAssignment,
  listRoomingAssignments,
  setRoomingDelegates,
  updateRoomingAssignment,
} from "./service-rooming.js"
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  setSessionInclusions,
  updateSession,
} from "./service-sessions.js"
import {
  createProgramSchema,
  programListQuerySchema,
  programStatusSchema,
  programTypeSchema,
  updateProgramSchema,
} from "./validation.js"
import {
  createDelegateSchema,
  delegateListQuerySchema,
  delegateRoleSchema,
  delegateStatusSchema,
  enrollDelegateSchema,
  enrollmentStatusSchema,
  updateDelegateSchema,
} from "./validation-delegates.js"
import {
  addBidEvaluationSchema,
  awardRfpSchema,
  bidStatusSchema,
  createBidSchema,
  createRfpSchema,
  inviteSupplierSchema,
  rfpListQuerySchema,
  rfpStatusSchema,
  setBidLinesSchema,
  updateBidSchema,
  updateRfpSchema,
} from "./validation-rfp.js"
import {
  createRoomingAssignmentSchema,
  roomingListQuerySchema,
  setRoomingDelegatesSchema,
  updateRoomingAssignmentSchema,
} from "./validation-rooming.js"
import {
  createSessionSchema,
  sessionInclusionKindSchema,
  sessionListQuerySchema,
  sessionTypeSchema,
  setSessionInclusionsSchema,
  updateSessionSchema,
} from "./validation-sessions.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

// --- shared response building blocks ----------------------------------------

const errorResponseSchema = z.object({ error: z.string() })
const successResponseSchema = z.object({ success: z.literal(true) })
const idParamSchema = z.object({ id: z.string() })

// §17: timestamp/date columns serialize to ISO strings on the wire.
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

/** Local list envelope — MICE lists return `{ data, limit, offset }` (no total). */
const listEnvelope = <T extends z.ZodTypeAny>(row: T) =>
  z.object({
    data: z.array(row),
    limit: z.number().int(),
    offset: z.number().int(),
  })

const dataEnvelope = <T extends z.ZodTypeAny>(row: T) => z.object({ data: row })

// --- response row schemas (authored from the Drizzle `$inferSelect` shapes) --

const programSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullable(),
  primaryContactPersonId: z.string().nullable(),
  accountManagerId: z.string().nullable(),
  name: z.string(),
  code: z.string().nullable(),
  type: programTypeSchema,
  status: programStatusSchema,
  destination: z.string().nullable(),
  startDate: isoDate.nullable(),
  endDate: isoDate.nullable(),
  estimatedPax: z.number().int().nullable(),
  confirmedPax: z.number().int().nullable(),
  currency: z.string().nullable(),
  budgetAmountCents: z.number().int().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const sessionSchema = z.object({
  id: z.string(),
  programId: z.string(),
  functionSpaceId: z.string().nullable(),
  title: z.string(),
  sessionType: sessionTypeSchema,
  dayDate: isoDate.nullable(),
  startsAt: isoTimestamp.nullable(),
  endsAt: isoTimestamp.nullable(),
  track: z.string().nullable(),
  capacity: z.number().int().nullable(),
  requiresRegistration: z.boolean(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const sessionInclusionSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  kind: sessionInclusionKindSchema,
  description: z.string().nullable(),
  quantity: z.number().int(),
  costAmountCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const sessionWithInclusionsSchema = sessionSchema.extend({
  inclusions: z.array(sessionInclusionSchema),
})

const delegateSchema = z.object({
  id: z.string(),
  programId: z.string(),
  personId: z.string().nullable(),
  bookingId: z.string().nullable(),
  role: delegateRoleSchema,
  status: delegateStatusSchema,
  arrivalAt: isoTimestamp.nullable(),
  departureAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const enrollmentSchema = z.object({
  id: z.string(),
  delegateId: z.string(),
  sessionId: z.string(),
  status: enrollmentStatusSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const delegateWithEnrollmentsSchema = delegateSchema.extend({
  enrollments: z.array(enrollmentSchema),
})

const roomingAssignmentSchema = z.object({
  id: z.string(),
  programId: z.string(),
  roomBlockId: z.string().nullable(),
  roomTypeId: z.string().nullable(),
  bedConfig: z.string().nullable(),
  sharingGroupId: z.string().nullable(),
  checkIn: isoDate.nullable(),
  checkOut: isoDate.nullable(),
  specialRequests: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const roomingAssignmentDelegateSchema = z.object({
  id: z.string(),
  roomingAssignmentId: z.string(),
  delegateId: z.string(),
  isPrimary: z.boolean(),
  bedLabel: z.string().nullable(),
  createdAt: isoTimestamp,
})

const roomingWithDelegatesSchema = roomingAssignmentSchema.extend({
  delegates: z.array(roomingAssignmentDelegateSchema),
})

const rfpInvitationStatusSchema = z.enum(["invited", "viewed", "declined", "responded"])

const rfpSchema = z.object({
  id: z.string(),
  programId: z.string(),
  title: z.string(),
  requirements: jsonRecord.nullable(),
  status: rfpStatusSchema,
  issuedAt: isoTimestamp.nullable(),
  dueAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const rfpInvitationSchema = z.object({
  id: z.string(),
  rfpId: z.string(),
  supplierId: z.string(),
  status: rfpInvitationStatusSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const bidSchema = z.object({
  id: z.string(),
  rfpId: z.string(),
  supplierId: z.string(),
  status: bidStatusSchema,
  totalCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  proposalDoc: z.string().nullable(),
  validUntil: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const bidLineSchema = z.object({
  id: z.string(),
  bidId: z.string(),
  requirementRef: z.string().nullable(),
  description: z.string().nullable(),
  quantity: z.number().int(),
  unitCents: z.number().int().nullable(),
  totalCents: z.number().int().nullable(),
  createdAt: isoTimestamp,
})

const bidEvaluationSchema = z.object({
  id: z.string(),
  bidId: z.string(),
  criterion: z.string(),
  weight: z.number().int().nullable(),
  score: z.number().int().nullable(),
  notes: z.string().nullable(),
  evaluatedBy: z.string().nullable(),
  createdAt: isoTimestamp,
})

const rfpWithDetailsSchema = rfpSchema.extend({
  invitations: z.array(rfpInvitationSchema),
  bids: z.array(bidSchema),
})

const bidWithDetailsSchema = bidSchema.extend({
  lines: z.array(bidLineSchema),
  evaluations: z.array(bidEvaluationSchema),
})

// Program commercials — read-model cost sheet (no spine table).
const costSheetCategorySchema = z.object({
  contractedCostCents: z.number().int(),
  pickedCostCents: z.number().int(),
  pickedSellCents: z.number().int(),
})

const costSheetCurrencyTotalsSchema = z.object({
  currency: z.string(),
  roomBlocks: costSheetCategorySchema,
  spaceBlocks: costSheetCategorySchema,
  sessionInclusionsCostCents: z.number().int(),
  costCents: z.number().int(),
  sellCents: z.number().int(),
  marginCents: z.number().int(),
  marginPct: z.number().nullable(),
})

const programCostSheetSchema = z.object({
  programId: z.string(),
  mixedCurrency: z.boolean(),
  byCurrency: z.array(costSheetCurrencyTotalsSchema),
})

// === programs ===============================================================

const listProgramsRoute = createRoute({
  method: "get",
  path: "/programs",
  request: { query: programListQuerySchema },
  responses: {
    200: {
      description: "Paginated MICE programs",
      content: { "application/json": { schema: listEnvelope(programSchema) } },
    },
  },
})

const createProgramRoute = createRoute({
  method: "post",
  path: "/programs",
  request: {
    body: { required: true, content: { "application/json": { schema: createProgramSchema } } },
  },
  responses: {
    201: {
      description: "The created program",
      content: { "application/json": { schema: dataEnvelope(programSchema) } },
    },
    400: invalidRequestResponse,
  },
})

const getProgramRoute = createRoute({
  method: "get",
  path: "/programs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A program by id",
      content: { "application/json": { schema: dataEnvelope(programSchema) } },
    },
    404: notFoundResponse("Program not found"),
  },
})

const getProgramCostSheetRoute = createRoute({
  method: "get",
  path: "/programs/{id}/cost-sheet",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The program cost sheet / P&L grouped by currency",
      content: { "application/json": { schema: dataEnvelope(programCostSheetSchema) } },
    },
    404: notFoundResponse("Program not found"),
  },
})

const updateProgramRoute = createRoute({
  method: "patch",
  path: "/programs/{id}",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: updateProgramSchema } } },
  },
  responses: {
    200: {
      description: "The updated program",
      content: { "application/json": { schema: dataEnvelope(programSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Program not found"),
  },
})

const programRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listProgramsRoute, async (c) =>
    c.json(await listPrograms(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createProgramRoute, async (c) =>
    c.json({ data: await createProgram(c.get("db"), c.req.valid("json")) }, 201),
  )
  // static sub-resource before the dynamic `/{id}` catch-all
  .openapi(getProgramCostSheetRoute, async (c) => {
    const id = c.req.valid("param").id
    const program = await getProgram(c.get("db"), id)
    if (!program) return c.json({ error: "Program not found" }, 404)
    return c.json({ data: await commercialsService.getProgramCostSheet(c.get("db"), id) }, 200)
  })
  .openapi(getProgramRoute, async (c) => {
    const program = await getProgram(c.get("db"), c.req.valid("param").id)
    return program ? c.json({ data: program }, 200) : c.json({ error: "Program not found" }, 404)
  })
  .openapi(updateProgramRoute, async (c) => {
    const program = await updateProgram(c.get("db"), c.req.valid("param").id, c.req.valid("json"))
    return program ? c.json({ data: program }, 200) : c.json({ error: "Program not found" }, 404)
  })

// === sessions ===============================================================

const listSessionsRoute = createRoute({
  method: "get",
  path: "/sessions",
  request: { query: sessionListQuerySchema },
  responses: {
    200: {
      description: "Paginated agenda sessions",
      content: { "application/json": { schema: listEnvelope(sessionSchema) } },
    },
  },
})

const createSessionRoute = createRoute({
  method: "post",
  path: "/sessions",
  request: {
    body: { required: true, content: { "application/json": { schema: createSessionSchema } } },
  },
  responses: {
    201: {
      description: "The created session",
      content: { "application/json": { schema: dataEnvelope(sessionSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Program not found"),
  },
})

const getSessionRoute = createRoute({
  method: "get",
  path: "/sessions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A session by id with its inclusions",
      content: { "application/json": { schema: dataEnvelope(sessionWithInclusionsSchema) } },
    },
    404: notFoundResponse("Session not found"),
  },
})

const updateSessionRoute = createRoute({
  method: "patch",
  path: "/sessions/{id}",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: updateSessionSchema } } },
  },
  responses: {
    200: {
      description: "The updated session",
      content: { "application/json": { schema: dataEnvelope(sessionSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Session not found"),
  },
})

const deleteSessionRoute = createRoute({
  method: "delete",
  path: "/sessions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Session deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Session not found"),
  },
})

const setSessionInclusionsRoute = createRoute({
  method: "put",
  path: "/sessions/{id}/inclusions",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: setSessionInclusionsSchema } },
    },
  },
  responses: {
    200: {
      description: "The replaced session inclusions",
      content: { "application/json": { schema: dataEnvelope(z.array(sessionInclusionSchema)) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Session not found"),
  },
})

const sessionRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listSessionsRoute, async (c) =>
    c.json(await listSessions(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createSessionRoute, async (c) => {
    const outcome = await createSession(c.get("db"), c.req.valid("json"))
    if (outcome.status === "program_not_found") return c.json({ error: "Program not found" }, 404)
    return c.json({ data: outcome.session }, 201)
  })
  .openapi(getSessionRoute, async (c) => {
    const session = await getSession(c.get("db"), c.req.valid("param").id)
    return session ? c.json({ data: session }, 200) : c.json({ error: "Session not found" }, 404)
  })
  .openapi(updateSessionRoute, async (c) => {
    const session = await updateSession(c.get("db"), c.req.valid("param").id, c.req.valid("json"))
    return session ? c.json({ data: session }, 200) : c.json({ error: "Session not found" }, 404)
  })
  .openapi(deleteSessionRoute, async (c) => {
    const ok = await deleteSession(c.get("db"), c.req.valid("param").id)
    return ok
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Session not found" }, 404)
  })
  .openapi(setSessionInclusionsRoute, async (c) => {
    const id = c.req.valid("param").id
    const session = await getSession(c.get("db"), id)
    if (!session) return c.json({ error: "Session not found" }, 404)
    const { inclusions } = c.req.valid("json")
    return c.json({ data: await setSessionInclusions(c.get("db"), id, inclusions) }, 200)
  })

// === delegates ==============================================================

const listDelegatesRoute = createRoute({
  method: "get",
  path: "/delegates",
  request: { query: delegateListQuerySchema },
  responses: {
    200: {
      description: "Paginated program delegates",
      content: { "application/json": { schema: listEnvelope(delegateSchema) } },
    },
  },
})

const createDelegateRoute = createRoute({
  method: "post",
  path: "/delegates",
  request: {
    body: { required: true, content: { "application/json": { schema: createDelegateSchema } } },
  },
  responses: {
    201: {
      description: "The created delegate",
      content: { "application/json": { schema: dataEnvelope(delegateSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Program not found"),
  },
})

const getDelegateRoute = createRoute({
  method: "get",
  path: "/delegates/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A delegate by id with its session enrollments",
      content: { "application/json": { schema: dataEnvelope(delegateWithEnrollmentsSchema) } },
    },
    404: notFoundResponse("Delegate not found"),
  },
})

const updateDelegateRoute = createRoute({
  method: "patch",
  path: "/delegates/{id}",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: updateDelegateSchema } } },
  },
  responses: {
    200: {
      description: "The updated delegate",
      content: { "application/json": { schema: dataEnvelope(delegateSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Delegate not found"),
  },
})

const enrollDelegateRoute = createRoute({
  method: "post",
  path: "/delegates/{id}/enrollments",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: enrollDelegateSchema } } },
  },
  responses: {
    200: {
      description: "The existing enrollment (idempotent)",
      content: { "application/json": { schema: dataEnvelope(enrollmentSchema) } },
    },
    201: {
      description: "The created enrollment",
      content: { "application/json": { schema: dataEnvelope(enrollmentSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Delegate or session not found"),
    409: {
      description: "Session belongs to a different program",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

function createDelegateRoutes(runtime: MiceRouteRuntime = {}): OpenAPIHono<Env> {
  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(listDelegatesRoute, async (c) =>
      c.json(await listDelegates(c.get("db"), c.req.valid("query")), 200),
    )
    .openapi(createDelegateRoute, async (c) => {
      const outcome = await createDelegate(c.get("db"), c.req.valid("json"), runtime)
      if (outcome.status === "program_not_found") return c.json({ error: "Program not found" }, 404)
      return c.json({ data: outcome.delegate }, 201)
    })
    .openapi(getDelegateRoute, async (c) => {
      const delegate = await getDelegate(c.get("db"), c.req.valid("param").id)
      return delegate
        ? c.json({ data: delegate }, 200)
        : c.json({ error: "Delegate not found" }, 404)
    })
    .openapi(updateDelegateRoute, async (c) => {
      const delegate = await updateDelegate(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
        runtime,
      )
      return delegate
        ? c.json({ data: delegate }, 200)
        : c.json({ error: "Delegate not found" }, 404)
    })
    .openapi(enrollDelegateRoute, async (c) => {
      const outcome = await enrollDelegate(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      switch (outcome.status) {
        case "ok":
          return c.json({ data: outcome.enrollment }, outcome.idempotent ? 200 : 201)
        case "delegate_not_found":
          return c.json({ error: "Delegate not found" }, 404)
        case "session_not_found":
          return c.json({ error: "Session not found" }, 404)
        case "program_mismatch":
          return c.json({ error: "Session belongs to a different program" }, 409)
      }
    })
}

// === rooming assignments ====================================================

const listRoomingAssignmentsRoute = createRoute({
  method: "get",
  path: "/rooming-assignments",
  request: { query: roomingListQuerySchema },
  responses: {
    200: {
      description: "Paginated rooming assignments",
      content: { "application/json": { schema: listEnvelope(roomingAssignmentSchema) } },
    },
  },
})

const createRoomingAssignmentRoute = createRoute({
  method: "post",
  path: "/rooming-assignments",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createRoomingAssignmentSchema } },
    },
  },
  responses: {
    201: {
      description: "The created rooming assignment",
      content: { "application/json": { schema: dataEnvelope(roomingAssignmentSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Program not found"),
  },
})

const getRoomingAssignmentRoute = createRoute({
  method: "get",
  path: "/rooming-assignments/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A rooming assignment by id with its delegates",
      content: { "application/json": { schema: dataEnvelope(roomingWithDelegatesSchema) } },
    },
    404: notFoundResponse("Rooming assignment not found"),
  },
})

const updateRoomingAssignmentRoute = createRoute({
  method: "patch",
  path: "/rooming-assignments/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateRoomingAssignmentSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated rooming assignment",
      content: { "application/json": { schema: dataEnvelope(roomingAssignmentSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Rooming assignment not found"),
  },
})

const setRoomingDelegatesRoute = createRoute({
  method: "put",
  path: "/rooming-assignments/{id}/delegates",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: setRoomingDelegatesSchema } },
    },
  },
  responses: {
    200: {
      description: "The replaced rooming-assignment occupants",
      content: {
        "application/json": { schema: dataEnvelope(z.array(roomingAssignmentDelegateSchema)) },
      },
    },
    400: invalidRequestResponse,
    404: {
      description: "Rooming assignment not found, or one or more delegates not found",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            detail: z.object({ missing: z.array(z.string()) }).optional(),
          }),
        },
      },
    },
    409: {
      description: "One or more delegates belong to a different program",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            detail: z.object({ offending: z.array(z.string()) }).optional(),
          }),
        },
      },
    },
  },
})

const roomingRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listRoomingAssignmentsRoute, async (c) =>
    c.json(await listRoomingAssignments(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createRoomingAssignmentRoute, async (c) => {
    const outcome = await createRoomingAssignment(c.get("db"), c.req.valid("json"))
    if (outcome.status === "program_not_found") return c.json({ error: "Program not found" }, 404)
    return c.json({ data: outcome.assignment }, 201)
  })
  .openapi(getRoomingAssignmentRoute, async (c) => {
    const assignment = await getRoomingAssignment(c.get("db"), c.req.valid("param").id)
    return assignment
      ? c.json({ data: assignment }, 200)
      : c.json({ error: "Rooming assignment not found" }, 404)
  })
  .openapi(updateRoomingAssignmentRoute, async (c) => {
    const assignment = await updateRoomingAssignment(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return assignment
      ? c.json({ data: assignment }, 200)
      : c.json({ error: "Rooming assignment not found" }, 404)
  })
  .openapi(setRoomingDelegatesRoute, async (c) => {
    const { delegates } = c.req.valid("json")
    const outcome = await setRoomingDelegates(c.get("db"), c.req.valid("param").id, delegates)
    switch (outcome.status) {
      case "ok":
        return c.json({ data: outcome.delegates }, 200)
      case "assignment_not_found":
        return c.json({ error: "Rooming assignment not found" }, 404)
      case "delegate_not_found":
        return c.json({ error: "Delegate not found", detail: { missing: outcome.missing } }, 404)
      case "program_mismatch":
        return c.json(
          {
            error: "Delegate belongs to a different program",
            detail: { offending: outcome.offending },
          },
          409,
        )
    }
  })

// === RFPs ===================================================================

const listRfpsRoute = createRoute({
  method: "get",
  path: "/rfps",
  request: { query: rfpListQuerySchema },
  responses: {
    200: {
      description: "Paginated RFPs",
      content: { "application/json": { schema: listEnvelope(rfpSchema) } },
    },
  },
})

const createRfpRoute = createRoute({
  method: "post",
  path: "/rfps",
  request: {
    body: { required: true, content: { "application/json": { schema: createRfpSchema } } },
  },
  responses: {
    201: {
      description: "The created RFP",
      content: { "application/json": { schema: dataEnvelope(rfpSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Program not found"),
  },
})

const getRfpRoute = createRoute({
  method: "get",
  path: "/rfps/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An RFP by id with its invitations and bids",
      content: { "application/json": { schema: dataEnvelope(rfpWithDetailsSchema) } },
    },
    404: notFoundResponse("RFP not found"),
  },
})

const updateRfpRoute = createRoute({
  method: "patch",
  path: "/rfps/{id}",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: updateRfpSchema } } },
  },
  responses: {
    200: {
      description: "The updated RFP",
      content: { "application/json": { schema: dataEnvelope(rfpSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("RFP not found"),
  },
})

const inviteSupplierRoute = createRoute({
  method: "post",
  path: "/rfps/{id}/invitations",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: inviteSupplierSchema } } },
  },
  responses: {
    200: {
      description: "The existing invitation (idempotent)",
      content: { "application/json": { schema: dataEnvelope(rfpInvitationSchema) } },
    },
    201: {
      description: "The created invitation",
      content: { "application/json": { schema: dataEnvelope(rfpInvitationSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("RFP not found"),
  },
})

const createBidRoute = createRoute({
  method: "post",
  path: "/rfps/{id}/bids",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: createBidSchema } } },
  },
  responses: {
    201: {
      description: "The created bid",
      content: { "application/json": { schema: dataEnvelope(bidSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("RFP not found"),
  },
})

const awardRfpRoute = createRoute({
  method: "post",
  path: "/rfps/{id}/award",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: awardRfpSchema } } },
  },
  responses: {
    200: {
      description: "The awarded RFP and accepted bid",
      content: {
        "application/json": {
          schema: z.object({ data: z.object({ rfp: rfpSchema, bid: bidSchema }) }),
        },
      },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("RFP or bid not found"),
    409: {
      description: "RFP is already awarded",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const rfpRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listRfpsRoute, async (c) =>
    c.json(await rfpService.listRfps(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createRfpRoute, async (c) => {
    const outcome = await rfpService.createRfp(c.get("db"), c.req.valid("json"))
    if (outcome.status === "program_not_found") return c.json({ error: "Program not found" }, 404)
    return c.json({ data: outcome.rfp }, 201)
  })
  // static sub-resources before the dynamic `/{id}` catch-all
  .openapi(inviteSupplierRoute, async (c) => {
    const outcome = await rfpService.inviteSupplier(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (outcome.status === "rfp_not_found") return c.json({ error: "RFP not found" }, 404)
    return c.json({ data: outcome.invitation }, outcome.idempotent ? 200 : 201)
  })
  .openapi(createBidRoute, async (c) => {
    const outcome = await rfpService.createBid(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (outcome.status === "rfp_not_found") return c.json({ error: "RFP not found" }, 404)
    return c.json({ data: outcome.bid }, 201)
  })
  .openapi(awardRfpRoute, async (c) => {
    const { bidId } = c.req.valid("json")
    const outcome = await rfpService.awardRfp(c.get("db"), c.req.valid("param").id, bidId)
    switch (outcome.status) {
      case "ok":
        return c.json({ data: { rfp: outcome.rfp, bid: outcome.bid } }, 200)
      case "rfp_not_found":
        return c.json({ error: "RFP not found" }, 404)
      case "bid_not_found":
        return c.json({ error: "Bid not found on this RFP" }, 404)
      case "already_awarded":
        return c.json({ error: "RFP is already awarded" }, 409)
    }
  })
  .openapi(getRfpRoute, async (c) => {
    const rfp = await rfpService.getRfp(c.get("db"), c.req.valid("param").id)
    return rfp ? c.json({ data: rfp }, 200) : c.json({ error: "RFP not found" }, 404)
  })
  .openapi(updateRfpRoute, async (c) => {
    const rfp = await rfpService.updateRfp(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return rfp ? c.json({ data: rfp }, 200) : c.json({ error: "RFP not found" }, 404)
  })

// === bids ===================================================================

const getBidRoute = createRoute({
  method: "get",
  path: "/bids/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A bid by id with its lines and evaluations",
      content: { "application/json": { schema: dataEnvelope(bidWithDetailsSchema) } },
    },
    404: notFoundResponse("Bid not found"),
  },
})

const updateBidRoute = createRoute({
  method: "patch",
  path: "/bids/{id}",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: updateBidSchema } } },
  },
  responses: {
    200: {
      description: "The updated bid",
      content: { "application/json": { schema: dataEnvelope(bidSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Bid not found"),
  },
})

const setBidLinesRoute = createRoute({
  method: "put",
  path: "/bids/{id}/lines",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: setBidLinesSchema } } },
  },
  responses: {
    200: {
      description: "The replaced bid line items",
      content: { "application/json": { schema: dataEnvelope(z.array(bidLineSchema)) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Bid not found"),
  },
})

const addBidEvaluationRoute = createRoute({
  method: "post",
  path: "/bids/{id}/evaluations",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: addBidEvaluationSchema } } },
  },
  responses: {
    201: {
      description: "The created bid evaluation",
      content: { "application/json": { schema: dataEnvelope(bidEvaluationSchema) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Bid not found"),
  },
})

const bidRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  // static sub-resources before the dynamic `/{id}` catch-all
  .openapi(setBidLinesRoute, async (c) => {
    const { lines } = c.req.valid("json")
    const outcome = await rfpService.setBidLines(c.get("db"), c.req.valid("param").id, lines)
    if (outcome.status === "bid_not_found") return c.json({ error: "Bid not found" }, 404)
    return c.json({ data: outcome.lines }, 200)
  })
  .openapi(addBidEvaluationRoute, async (c) => {
    const outcome = await rfpService.addBidEvaluation(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (outcome.status === "bid_not_found") return c.json({ error: "Bid not found" }, 404)
    return c.json({ data: outcome.evaluation }, 201)
  })
  .openapi(getBidRoute, async (c) => {
    const bid = await rfpService.getBid(c.get("db"), c.req.valid("param").id)
    return bid ? c.json({ data: bid }, 200) : c.json({ error: "Bid not found" }, 404)
  })
  .openapi(updateBidRoute, async (c) => {
    const bid = await rfpService.updateBid(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return bid ? c.json({ data: bid }, 200) : c.json({ error: "Bid not found" }, 404)
  })

/**
 * Compose the per-resource sub-chains onto a single `OpenAPIHono` so the
 * `.openapi()` operations propagate up through any parent registry while keeping
 * type-inference cost bounded (one flat chain has O(n²) inference cost).
 */
export function createMiceAdminRoutes(runtime: MiceRouteRuntime = {}): OpenAPIHono<Env> {
  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .route("/", programRoutes)
    .route("/", sessionRoutes)
    .route("/", createDelegateRoutes(runtime))
    .route("/", roomingRoutes)
    .route("/", rfpRoutes)
    .route("/", bidRoutes)
}

export const miceAdminRoutes = createMiceAdminRoutes()

export type MiceAdminRoutes = ReturnType<typeof createMiceAdminRoutes>
