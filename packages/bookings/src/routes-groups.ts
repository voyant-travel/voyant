/**
 * Admin routes for booking groups — the shared-room / split-booking model.
 * Mounted under the booking admin surface at `/v1/admin/bookings/groups/*`.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114).
 * Request schemas reuse the existing `@voyant-travel/bookings-contracts`
 * schemas the handlers already parse; the list uses the framework's canonical
 * `listResponseSchema(...)` envelope; response row schemas are authored from the
 * Drizzle `$inferSelect` shapes (§17: timestamp columns serialize to ISO strings
 * over the wire). The group-detail GET extends the base row with the joined
 * `members` array; the add-member POST carries a typed
 * `group_not_found`/`booking_not_found`/`already_in_group` union declared inline
 * per leg. The business logic + service wiring are unchanged.
 *
 * Split into per-resource child `OpenAPIHono` sub-chains (`.route("/", child)`)
 * rather than one long flat `.openapi()` chain to keep tsc inference linear.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import { createBookingsAdminRoute as createRoute } from "./routes-openapi.js"
import { bookingGroupsService } from "./service-groups.js"
import {
  addBookingGroupMemberSchema,
  bookingGroupKindSchema,
  bookingGroupListQuerySchema,
  bookingGroupMemberRoleSchema,
  insertBookingGroupSchema,
  updateBookingGroupSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: Parameters<typeof bookingGroupsService.listBookingGroups>[0]
    userId?: string
  }
}

// --- shared response building blocks --------------------------------------
// Authored from the Drizzle `$inferSelect` shapes; §17: timestamp columns are
// ISO strings on the wire.

const isoTimestamp = z.string()
const errorResponseSchema = z.object({ error: z.string() })
const deleteResponseSchema = z.object({ success: z.boolean() })
const idParamSchema = z.object({ id: z.string() })
const jsonObject = z.record(z.string(), z.unknown())

// --- row response schemas (from $inferSelect) ------------------------------

const bookingGroupSchema = z.object({
  id: z.string(),
  kind: bookingGroupKindSchema,
  label: z.string(),
  primaryBookingId: z.string().nullable(),
  productId: z.string().nullable(),
  optionUnitId: z.string().nullable(),
  metadata: jsonObject.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const bookingGroupMemberSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  bookingId: z.string(),
  role: bookingGroupMemberRoleSchema,
  createdAt: isoTimestamp,
})

// `GET /:id` returns the base group joined with its members.
const bookingGroupWithMembersSchema = bookingGroupSchema.extend({
  members: z.array(bookingGroupMemberSchema),
})

// `GET /:id/travelers` returns each group booking's travelers. The service
// projection is bespoke; author it permissively as a traveler row plus its
// owning booking id.
const bookingGroupTravelerSchema = z
  .object({
    id: z.string(),
    bookingId: z.string(),
  })
  .passthrough()

// --- helpers ---------------------------------------------------------------

function jsonBody<S extends z.ZodTypeAny>(schema: S, required: boolean, description: string) {
  return {
    required,
    description,
    content: { "application/json": { schema } },
  }
}

function dataResponse<S extends z.ZodTypeAny>(schema: S, description: string) {
  return {
    description,
    content: { "application/json": { schema: z.object({ data: schema }) } },
  }
}

function listResponse<S extends z.ZodTypeAny>(schema: S, description: string) {
  return {
    description,
    content: { "application/json": { schema: listResponseSchema(schema) } },
  }
}

function notFoundResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: errorResponseSchema } },
  }
}

function deletedResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: deleteResponseSchema } },
  }
}

const invalidRequestResponse = {
  description: "invalid_request — request input failed validation",
  content: { "application/json": { schema: errorResponseSchema } },
}

// --- groups CRUD sub-chain -------------------------------------------------

const listGroupsRoute = createRoute({
  method: "get",
  path: "/",
  request: { query: bookingGroupListQuerySchema },
  responses: {
    200: listResponse(bookingGroupSchema, "Paginated booking groups"),
    400: invalidRequestResponse,
  },
})

const createGroupRoute = createRoute({
  method: "post",
  path: "/",
  request: { body: jsonBody(insertBookingGroupSchema, true, "Booking group") },
  responses: {
    201: dataResponse(bookingGroupSchema, "The created booking group"),
    400: invalidRequestResponse,
  },
})

const getGroupRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(bookingGroupWithMembersSchema, "A booking group with its members"),
    404: notFoundResponse("Booking group not found"),
  },
})

const updateGroupRoute = createRoute({
  method: "patch",
  path: "/{id}",
  request: {
    params: idParamSchema,
    body: jsonBody(updateBookingGroupSchema, false, "Partial booking group update"),
  },
  responses: {
    200: dataResponse(bookingGroupSchema, "The updated booking group"),
    400: invalidRequestResponse,
    404: notFoundResponse("Booking group not found"),
  },
})

const deleteGroupRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: { params: idParamSchema },
  responses: {
    200: deletedResponse("The booking group was deleted"),
    404: notFoundResponse("Booking group not found"),
  },
})

const groupsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listGroupsRoute, async (c) => {
    return c.json(
      await bookingGroupsService.listBookingGroups(c.get("db"), c.req.valid("query")),
      200,
    )
  })
  .openapi(createGroupRoute, async (c) => {
    const row = await bookingGroupsService.createBookingGroup(c.get("db"), c.req.valid("json"))
    return c.json({ data: row }, 201)
  })
  .openapi(getGroupRoute, async (c) => {
    const row = await bookingGroupsService.getBookingGroupById(c.get("db"), c.req.valid("param").id)
    if (!row) return c.json({ error: "Booking group not found" }, 404)
    const members = await bookingGroupsService.listGroupMembers(c.get("db"), row.id)
    return c.json({ data: { ...row, members } }, 200)
  })
  .openapi(updateGroupRoute, async (c) => {
    const row = await bookingGroupsService.updateBookingGroup(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "Booking group not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(deleteGroupRoute, async (c) => {
    const row = await bookingGroupsService.deleteBookingGroup(c.get("db"), c.req.valid("param").id)
    if (!row) return c.json({ error: "Booking group not found" }, 404)
    return c.json({ success: true }, 200)
  })

// --- members sub-chain -----------------------------------------------------

const listMembersRoute = createRoute({
  method: "get",
  path: "/{id}/members",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(z.array(bookingGroupMemberSchema), "The booking group members"),
  },
})

const addMemberRoute = createRoute({
  method: "post",
  path: "/{id}/members",
  request: {
    params: idParamSchema,
    body: jsonBody(addBookingGroupMemberSchema, true, "Booking group member to add"),
  },
  responses: {
    201: dataResponse(bookingGroupMemberSchema, "The added booking group member"),
    400: invalidRequestResponse,
    404: notFoundResponse("Booking group or booking not found"),
    409: {
      description: "already_in_group — the booking already belongs to a group",
      content: {
        "application/json": {
          schema: z.object({ error: z.string(), currentGroupId: z.string() }),
        },
      },
    },
  },
})

const removeMemberRoute = createRoute({
  method: "delete",
  path: "/{id}/members/{bookingId}",
  request: {
    params: z.object({ id: z.string(), bookingId: z.string() }),
  },
  responses: {
    200: deletedResponse("The membership was removed"),
    404: notFoundResponse("Membership not found"),
  },
})

const listGroupTravelersRoute = createRoute({
  method: "get",
  path: "/{id}/travelers",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(
      z.array(bookingGroupTravelerSchema),
      "Travelers across the group's member bookings",
    ),
  },
})

const membersRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listMembersRoute, async (c) => {
    const members = await bookingGroupsService.listGroupMembers(
      c.get("db"),
      c.req.valid("param").id,
    )
    return c.json({ data: members }, 200)
  })
  .openapi(addMemberRoute, async (c) => {
    const result = await bookingGroupsService.addGroupMember(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (result.status === "group_not_found") {
      return c.json({ error: "Booking group not found" }, 404)
    }
    if (result.status === "booking_not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }
    if (result.status === "already_in_group") {
      return c.json(
        {
          error: "Booking is already in a group",
          currentGroupId: result.currentGroupId,
        },
        409,
      )
    }
    return c.json({ data: result.member }, 201)
  })
  .openapi(removeMemberRoute, async (c) => {
    const row = await bookingGroupsService.removeGroupMember(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("param").bookingId,
    )
    if (!row) return c.json({ error: "Membership not found" }, 404)
    return c.json({ success: true }, 200)
  })
  .openapi(listGroupTravelersRoute, async (c) => {
    const travelers = await bookingGroupsService.listGroupBookingTravelers(
      c.get("db"),
      c.req.valid("param").id,
    )
    return c.json({ data: travelers }, 200)
  })

export const bookingGroupRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", groupsRoutes)
  .route("/", membersRoutes)

export type BookingGroupRoutes = typeof bookingGroupRoutes

export const __test__ = {
  bookingGroupSchema,
  bookingGroupMemberSchema,
  bookingGroupWithMembersSchema,
}
