/**
 * Availability "pickups" admin routes — the CRUD/batch surfaces for the seven
 * pickup-and-meeting resources: availability pickup points, slot pickups,
 * product meeting configs, pickup groups, pickup locations, location pickup
 * times, and custom pickup areas. Mounted on the legacy
 * `/v1/operations/availability/*` surface (operator React clients hit those
 * paths) AND, for the published OpenAPI admin contract, on the staff surface at
 * `/v1/admin/operations/availability/*` (see `availability/routes.ts`).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208 — operations sub-batch 10C). Request schemas reuse the exported
 * `validation.ts` insert/update/list-query schemas the handlers already parse;
 * response row schemas are authored here from the Drizzle `$inferSelect` shapes
 * (§17 dates → strings, plus the service-joined `productName` on the pickup-point
 * and meeting-config list rows). Each resource is its own small `OpenAPIHono`
 * sub-chain composed onto `availabilityPickupRoutes` via `.route("/")` so the
 * `.openapi()` operations propagate up through the parent availability
 * registries while keeping type-inference cost bounded (one flat chain has O(n²)
 * inference cost).
 *
 * agent-quality: file-size exception — intentional: a mechanically-repetitive
 * CRUD + batch bundle over seven pickup resources (49 legs), each with a
 * `createRoute` def + co-located handler per the established admin route pattern
 * (mirrors `routes-core.ts`). Splitting per resource would fragment the single
 * mounted instance without aiding review. See voyant#2114 / voyant#2208
 * (operations sub-batch 10C).
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"

import {
  batchIdsSchema,
  createBatchUpdateSchema,
  type Env,
  handleBatchDelete,
  handleBatchUpdate,
} from "./routes-shared.js"
import { availabilityService } from "./service.js"
import {
  availabilityPickupPointListQuerySchema,
  availabilitySlotPickupListQuerySchema,
  customPickupAreaListQuerySchema,
  insertAvailabilityPickupPointSchema,
  insertAvailabilitySlotPickupSchema,
  insertCustomPickupAreaSchema,
  insertLocationPickupTimeSchema,
  insertPickupGroupSchema,
  insertPickupLocationSchema,
  insertProductMeetingConfigSchema,
  locationPickupTimeListQuerySchema,
  pickupGroupListQuerySchema,
  pickupLocationListQuerySchema,
  productMeetingConfigListQuerySchema,
  updateAvailabilityPickupPointSchema,
  updateAvailabilitySlotPickupSchema,
  updateCustomPickupAreaSchema,
  updateLocationPickupTimeSchema,
  updatePickupGroupSchema,
  updatePickupLocationSchema,
  updateProductMeetingConfigSchema,
} from "./validation.js"

const batchUpdateAvailabilityPickupPointSchema = createBatchUpdateSchema(
  updateAvailabilityPickupPointSchema,
)
const batchUpdateAvailabilitySlotPickupSchema = createBatchUpdateSchema(
  updateAvailabilitySlotPickupSchema,
)
const batchUpdateProductMeetingConfigSchema = createBatchUpdateSchema(
  updateProductMeetingConfigSchema,
)
const batchUpdatePickupGroupSchema = createBatchUpdateSchema(updatePickupGroupSchema)
const batchUpdatePickupLocationSchema = createBatchUpdateSchema(updatePickupLocationSchema)
const batchUpdateLocationPickupTimeSchema = createBatchUpdateSchema(updateLocationPickupTimeSchema)
const batchUpdateCustomPickupAreaSchema = createBatchUpdateSchema(updateCustomPickupAreaSchema)

// --- shared response schemas ------------------------------------------------

const errorResponseSchema = z.object({ error: z.string() })
const successResponseSchema = z.object({ success: z.literal(true) })
const idSchema = z.string()
const idParamSchema = z.object({ id: idSchema })
const isoTimestamp = z.string()

const meetingModeSchema = z.enum(["meeting_only", "pickup_only", "meet_or_pickup"])
const pickupGroupKindSchema = z.enum(["pickup", "dropoff", "meeting"])
const pickupTimingModeSchema = z.enum(["fixed_time", "offset_from_start"])

/** Envelope returned by the shared batch-update handler. */
function batchUpdateResponseSchema<T extends z.ZodTypeAny>(row: T) {
  return z.object({
    data: z.array(row),
    total: z.number().int(),
    succeeded: z.number().int(),
    failed: z.array(z.object({ id: idSchema, error: z.string() })),
  })
}

/** Envelope returned by the shared batch-delete handler. */
const batchDeleteResponseSchema = z.object({
  deletedIds: z.array(idSchema),
  total: z.number().int(),
  succeeded: z.number().int(),
  failed: z.array(z.object({ id: idSchema, error: z.string() })),
})

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

const availabilityPickupPointSchema = z.object({
  id: idSchema,
  productId: z.string(),
  facilityId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  locationText: z.string().nullable(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/**
 * The pickup-point list is left-joined to `products` for the display name.
 * `productName` is `nullable().optional()` because the service spreads the
 * table columns through a generic that widens the joined column to
 * `string | null | undefined`; on the wire it is always present (possibly
 * `null`).
 */
const availabilityPickupPointListRowSchema = availabilityPickupPointSchema.extend({
  productName: z.string().nullable().optional(),
})

const availabilitySlotPickupSchema = z.object({
  id: idSchema,
  slotId: z.string(),
  pickupPointId: z.string(),
  initialCapacity: z.number().int().nullable(),
  remainingCapacity: z.number().int().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const productMeetingConfigSchema = z.object({
  id: idSchema,
  productId: z.string(),
  optionId: z.string().nullable(),
  facilityId: z.string().nullable(),
  mode: meetingModeSchema,
  allowCustomPickup: z.boolean(),
  allowCustomDropoff: z.boolean(),
  requiresPickupSelection: z.boolean(),
  requiresDropoffSelection: z.boolean(),
  usePickupAllotment: z.boolean(),
  meetingInstructions: z.string().nullable(),
  pickupInstructions: z.string().nullable(),
  dropoffInstructions: z.string().nullable(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** The meeting-config list is left-joined to `products` for the display name. */
const productMeetingConfigListRowSchema = productMeetingConfigSchema.extend({
  productName: z.string().nullable().optional(),
})

const pickupGroupSchema = z.object({
  id: idSchema,
  meetingConfigId: z.string(),
  kind: pickupGroupKindSchema,
  name: z.string(),
  description: z.string().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const pickupLocationSchema = z.object({
  id: idSchema,
  groupId: z.string(),
  facilityId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  locationText: z.string().nullable(),
  leadTimeMinutes: z.number().int().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const locationPickupTimeSchema = z.object({
  id: idSchema,
  pickupLocationId: z.string(),
  slotId: z.string().nullable(),
  startTimeId: z.string().nullable(),
  timingMode: pickupTimingModeSchema,
  localTime: z.string().nullable(),
  offsetMinutes: z.number().int().nullable(),
  instructions: z.string().nullable(),
  initialCapacity: z.number().int().nullable(),
  remainingCapacity: z.number().int().nullable(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const customPickupAreaSchema = z.object({
  id: idSchema,
  meetingConfigId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  geographicText: z.string().nullable(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// --- pickup points ----------------------------------------------------------

const listPickupPointsRoute = createRoute({
  method: "get",
  path: "/pickup-points",
  request: { query: availabilityPickupPointListQuerySchema },
  responses: {
    200: {
      description: "Paginated availability pickup points",
      content: {
        "application/json": { schema: listResponseSchema(availabilityPickupPointListRowSchema) },
      },
    },
  },
})

const createPickupPointRoute = createRoute({
  method: "post",
  path: "/pickup-points",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertAvailabilityPickupPointSchema } },
    },
  },
  responses: {
    201: {
      description: "The created availability pickup point",
      content: {
        "application/json": { schema: z.object({ data: availabilityPickupPointSchema }) },
      },
    },
    400: invalidRequestResponse,
  },
})

const batchUpdatePickupPointsRoute = createRoute({
  method: "post",
  path: "/pickup-points/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdateAvailabilityPickupPointSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: {
        "application/json": { schema: batchUpdateResponseSchema(availabilityPickupPointSchema) },
      },
    },
    400: invalidRequestResponse,
  },
})

const batchDeletePickupPointsRoute = createRoute({
  method: "post",
  path: "/pickup-points/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: invalidRequestResponse,
  },
})

const getPickupPointRoute = createRoute({
  method: "get",
  path: "/pickup-points/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An availability pickup point by id",
      content: {
        "application/json": { schema: z.object({ data: availabilityPickupPointSchema }) },
      },
    },
    404: notFoundResponse("Availability pickup point not found"),
  },
})

const updatePickupPointRoute = createRoute({
  method: "patch",
  path: "/pickup-points/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateAvailabilityPickupPointSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated availability pickup point",
      content: {
        "application/json": { schema: z.object({ data: availabilityPickupPointSchema }) },
      },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Availability pickup point not found"),
  },
})

const deletePickupPointRoute = createRoute({
  method: "delete",
  path: "/pickup-points/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Availability pickup point deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Availability pickup point not found"),
  },
})

const pickupPointRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPickupPointsRoute, async (c) =>
    c.json(await availabilityService.listPickupPoints(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPickupPointRoute, async (c) => {
    const row = await availabilityService.createPickupPoint(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdatePickupPointsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: availabilityService.updatePickupPoint,
      }),
      200,
    )
  })
  .openapi(batchDeletePickupPointsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: availabilityService.deletePickupPoint,
      }),
      200,
    )
  })
  .openapi(getPickupPointRoute, async (c) => {
    const row = await availabilityService.getPickupPointById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Availability pickup point not found" }, 404)
  })
  .openapi(updatePickupPointRoute, async (c) => {
    const row = await availabilityService.updatePickupPoint(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Availability pickup point not found" }, 404)
  })
  .openapi(deletePickupPointRoute, async (c) => {
    const row = await availabilityService.deletePickupPoint(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Availability pickup point not found" }, 404)
  })

// --- slot pickups -----------------------------------------------------------

const listSlotPickupsRoute = createRoute({
  method: "get",
  path: "/slot-pickups",
  request: { query: availabilitySlotPickupListQuerySchema },
  responses: {
    200: {
      description: "Paginated availability slot pickups",
      content: {
        "application/json": { schema: listResponseSchema(availabilitySlotPickupSchema) },
      },
    },
  },
})

const createSlotPickupRoute = createRoute({
  method: "post",
  path: "/slot-pickups",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertAvailabilitySlotPickupSchema } },
    },
  },
  responses: {
    201: {
      description: "The created availability slot pickup",
      content: { "application/json": { schema: z.object({ data: availabilitySlotPickupSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const batchUpdateSlotPickupsRoute = createRoute({
  method: "post",
  path: "/slot-pickups/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdateAvailabilitySlotPickupSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: {
        "application/json": { schema: batchUpdateResponseSchema(availabilitySlotPickupSchema) },
      },
    },
    400: invalidRequestResponse,
  },
})

const batchDeleteSlotPickupsRoute = createRoute({
  method: "post",
  path: "/slot-pickups/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: invalidRequestResponse,
  },
})

const getSlotPickupRoute = createRoute({
  method: "get",
  path: "/slot-pickups/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An availability slot pickup by id",
      content: { "application/json": { schema: z.object({ data: availabilitySlotPickupSchema }) } },
    },
    404: notFoundResponse("Availability slot pickup not found"),
  },
})

const updateSlotPickupRoute = createRoute({
  method: "patch",
  path: "/slot-pickups/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateAvailabilitySlotPickupSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated availability slot pickup",
      content: { "application/json": { schema: z.object({ data: availabilitySlotPickupSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Availability slot pickup not found"),
  },
})

const deleteSlotPickupRoute = createRoute({
  method: "delete",
  path: "/slot-pickups/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Availability slot pickup deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Availability slot pickup not found"),
  },
})

const slotPickupRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listSlotPickupsRoute, async (c) =>
    c.json(await availabilityService.listSlotPickups(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createSlotPickupRoute, async (c) => {
    const row = await availabilityService.createSlotPickup(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdateSlotPickupsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: availabilityService.updateSlotPickup,
      }),
      200,
    )
  })
  .openapi(batchDeleteSlotPickupsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: availabilityService.deleteSlotPickup,
      }),
      200,
    )
  })
  .openapi(getSlotPickupRoute, async (c) => {
    const row = await availabilityService.getSlotPickupById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Availability slot pickup not found" }, 404)
  })
  .openapi(updateSlotPickupRoute, async (c) => {
    const row = await availabilityService.updateSlotPickup(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Availability slot pickup not found" }, 404)
  })
  .openapi(deleteSlotPickupRoute, async (c) => {
    const row = await availabilityService.deleteSlotPickup(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Availability slot pickup not found" }, 404)
  })

// --- product meeting configs ------------------------------------------------

const listMeetingConfigsRoute = createRoute({
  method: "get",
  path: "/meeting-configs",
  request: { query: productMeetingConfigListQuerySchema },
  responses: {
    200: {
      description: "Paginated product meeting configs",
      content: {
        "application/json": { schema: listResponseSchema(productMeetingConfigListRowSchema) },
      },
    },
  },
})

const createMeetingConfigRoute = createRoute({
  method: "post",
  path: "/meeting-configs",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertProductMeetingConfigSchema } },
    },
  },
  responses: {
    201: {
      description: "The created product meeting config",
      content: { "application/json": { schema: z.object({ data: productMeetingConfigSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const batchUpdateMeetingConfigsRoute = createRoute({
  method: "post",
  path: "/meeting-configs/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdateProductMeetingConfigSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: {
        "application/json": { schema: batchUpdateResponseSchema(productMeetingConfigSchema) },
      },
    },
    400: invalidRequestResponse,
  },
})

const batchDeleteMeetingConfigsRoute = createRoute({
  method: "post",
  path: "/meeting-configs/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: invalidRequestResponse,
  },
})

const getMeetingConfigRoute = createRoute({
  method: "get",
  path: "/meeting-configs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A product meeting config by id",
      content: { "application/json": { schema: z.object({ data: productMeetingConfigSchema }) } },
    },
    404: notFoundResponse("Product meeting config not found"),
  },
})

const updateMeetingConfigRoute = createRoute({
  method: "patch",
  path: "/meeting-configs/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateProductMeetingConfigSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated product meeting config",
      content: { "application/json": { schema: z.object({ data: productMeetingConfigSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Product meeting config not found"),
  },
})

const deleteMeetingConfigRoute = createRoute({
  method: "delete",
  path: "/meeting-configs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Product meeting config deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Product meeting config not found"),
  },
})

const meetingConfigRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listMeetingConfigsRoute, async (c) =>
    c.json(await availabilityService.listMeetingConfigs(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createMeetingConfigRoute, async (c) => {
    const row = await availabilityService.createMeetingConfig(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdateMeetingConfigsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: availabilityService.updateMeetingConfig,
      }),
      200,
    )
  })
  .openapi(batchDeleteMeetingConfigsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: availabilityService.deleteMeetingConfig,
      }),
      200,
    )
  })
  .openapi(getMeetingConfigRoute, async (c) => {
    const row = await availabilityService.getMeetingConfigById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Product meeting config not found" }, 404)
  })
  .openapi(updateMeetingConfigRoute, async (c) => {
    const row = await availabilityService.updateMeetingConfig(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Product meeting config not found" }, 404)
  })
  .openapi(deleteMeetingConfigRoute, async (c) => {
    const row = await availabilityService.deleteMeetingConfig(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Product meeting config not found" }, 404)
  })

// --- pickup groups ----------------------------------------------------------

const listPickupGroupsRoute = createRoute({
  method: "get",
  path: "/pickup-groups",
  request: { query: pickupGroupListQuerySchema },
  responses: {
    200: {
      description: "Paginated pickup groups",
      content: { "application/json": { schema: listResponseSchema(pickupGroupSchema) } },
    },
  },
})

const createPickupGroupRoute = createRoute({
  method: "post",
  path: "/pickup-groups",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPickupGroupSchema } },
    },
  },
  responses: {
    201: {
      description: "The created pickup group",
      content: { "application/json": { schema: z.object({ data: pickupGroupSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const batchUpdatePickupGroupsRoute = createRoute({
  method: "post",
  path: "/pickup-groups/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdatePickupGroupSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchUpdateResponseSchema(pickupGroupSchema) } },
    },
    400: invalidRequestResponse,
  },
})

const batchDeletePickupGroupsRoute = createRoute({
  method: "post",
  path: "/pickup-groups/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: invalidRequestResponse,
  },
})

const getPickupGroupRoute = createRoute({
  method: "get",
  path: "/pickup-groups/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A pickup group by id",
      content: { "application/json": { schema: z.object({ data: pickupGroupSchema }) } },
    },
    404: notFoundResponse("Pickup group not found"),
  },
})

const updatePickupGroupRoute = createRoute({
  method: "patch",
  path: "/pickup-groups/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePickupGroupSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated pickup group",
      content: { "application/json": { schema: z.object({ data: pickupGroupSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Pickup group not found"),
  },
})

const deletePickupGroupRoute = createRoute({
  method: "delete",
  path: "/pickup-groups/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Pickup group deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Pickup group not found"),
  },
})

const pickupGroupRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPickupGroupsRoute, async (c) =>
    c.json(await availabilityService.listPickupGroups(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPickupGroupRoute, async (c) => {
    const row = await availabilityService.createPickupGroup(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdatePickupGroupsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: availabilityService.updatePickupGroup,
      }),
      200,
    )
  })
  .openapi(batchDeletePickupGroupsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: availabilityService.deletePickupGroup,
      }),
      200,
    )
  })
  .openapi(getPickupGroupRoute, async (c) => {
    const row = await availabilityService.getPickupGroupById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Pickup group not found" }, 404)
  })
  .openapi(updatePickupGroupRoute, async (c) => {
    const row = await availabilityService.updatePickupGroup(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Pickup group not found" }, 404)
  })
  .openapi(deletePickupGroupRoute, async (c) => {
    const row = await availabilityService.deletePickupGroup(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Pickup group not found" }, 404)
  })

// --- pickup locations -------------------------------------------------------

const listPickupLocationsRoute = createRoute({
  method: "get",
  path: "/pickup-locations",
  request: { query: pickupLocationListQuerySchema },
  responses: {
    200: {
      description: "Paginated pickup locations",
      content: { "application/json": { schema: listResponseSchema(pickupLocationSchema) } },
    },
  },
})

const createPickupLocationRoute = createRoute({
  method: "post",
  path: "/pickup-locations",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPickupLocationSchema } },
    },
  },
  responses: {
    201: {
      description: "The created pickup location",
      content: { "application/json": { schema: z.object({ data: pickupLocationSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const batchUpdatePickupLocationsRoute = createRoute({
  method: "post",
  path: "/pickup-locations/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdatePickupLocationSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchUpdateResponseSchema(pickupLocationSchema) } },
    },
    400: invalidRequestResponse,
  },
})

const batchDeletePickupLocationsRoute = createRoute({
  method: "post",
  path: "/pickup-locations/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: invalidRequestResponse,
  },
})

const getPickupLocationRoute = createRoute({
  method: "get",
  path: "/pickup-locations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A pickup location by id",
      content: { "application/json": { schema: z.object({ data: pickupLocationSchema }) } },
    },
    404: notFoundResponse("Pickup location not found"),
  },
})

const updatePickupLocationRoute = createRoute({
  method: "patch",
  path: "/pickup-locations/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePickupLocationSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated pickup location",
      content: { "application/json": { schema: z.object({ data: pickupLocationSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Pickup location not found"),
  },
})

const deletePickupLocationRoute = createRoute({
  method: "delete",
  path: "/pickup-locations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Pickup location deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Pickup location not found"),
  },
})

const pickupLocationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPickupLocationsRoute, async (c) =>
    c.json(await availabilityService.listPickupLocations(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPickupLocationRoute, async (c) => {
    const row = await availabilityService.createPickupLocation(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdatePickupLocationsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: availabilityService.updatePickupLocation,
      }),
      200,
    )
  })
  .openapi(batchDeletePickupLocationsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: availabilityService.deletePickupLocation,
      }),
      200,
    )
  })
  .openapi(getPickupLocationRoute, async (c) => {
    const row = await availabilityService.getPickupLocationById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Pickup location not found" }, 404)
  })
  .openapi(updatePickupLocationRoute, async (c) => {
    const row = await availabilityService.updatePickupLocation(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Pickup location not found" }, 404)
  })
  .openapi(deletePickupLocationRoute, async (c) => {
    const row = await availabilityService.deletePickupLocation(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Pickup location not found" }, 404)
  })

// --- location pickup times --------------------------------------------------

const listLocationPickupTimesRoute = createRoute({
  method: "get",
  path: "/location-pickup-times",
  request: { query: locationPickupTimeListQuerySchema },
  responses: {
    200: {
      description: "Paginated location pickup times",
      content: { "application/json": { schema: listResponseSchema(locationPickupTimeSchema) } },
    },
  },
})

const createLocationPickupTimeRoute = createRoute({
  method: "post",
  path: "/location-pickup-times",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertLocationPickupTimeSchema } },
    },
  },
  responses: {
    201: {
      description: "The created location pickup time",
      content: { "application/json": { schema: z.object({ data: locationPickupTimeSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const batchUpdateLocationPickupTimesRoute = createRoute({
  method: "post",
  path: "/location-pickup-times/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdateLocationPickupTimeSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: {
        "application/json": { schema: batchUpdateResponseSchema(locationPickupTimeSchema) },
      },
    },
    400: invalidRequestResponse,
  },
})

const batchDeleteLocationPickupTimesRoute = createRoute({
  method: "post",
  path: "/location-pickup-times/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: invalidRequestResponse,
  },
})

const getLocationPickupTimeRoute = createRoute({
  method: "get",
  path: "/location-pickup-times/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A location pickup time by id",
      content: { "application/json": { schema: z.object({ data: locationPickupTimeSchema }) } },
    },
    404: notFoundResponse("Location pickup time not found"),
  },
})

const updateLocationPickupTimeRoute = createRoute({
  method: "patch",
  path: "/location-pickup-times/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateLocationPickupTimeSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated location pickup time",
      content: { "application/json": { schema: z.object({ data: locationPickupTimeSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Location pickup time not found"),
  },
})

const deleteLocationPickupTimeRoute = createRoute({
  method: "delete",
  path: "/location-pickup-times/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Location pickup time deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Location pickup time not found"),
  },
})

const locationPickupTimeRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listLocationPickupTimesRoute, async (c) =>
    c.json(
      await availabilityService.listLocationPickupTimes(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createLocationPickupTimeRoute, async (c) => {
    const row = await availabilityService.createLocationPickupTime(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdateLocationPickupTimesRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: availabilityService.updateLocationPickupTime,
      }),
      200,
    )
  })
  .openapi(batchDeleteLocationPickupTimesRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: availabilityService.deleteLocationPickupTime,
      }),
      200,
    )
  })
  .openapi(getLocationPickupTimeRoute, async (c) => {
    const row = await availabilityService.getLocationPickupTimeById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Location pickup time not found" }, 404)
  })
  .openapi(updateLocationPickupTimeRoute, async (c) => {
    const row = await availabilityService.updateLocationPickupTime(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Location pickup time not found" }, 404)
  })
  .openapi(deleteLocationPickupTimeRoute, async (c) => {
    const row = await availabilityService.deleteLocationPickupTime(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Location pickup time not found" }, 404)
  })

// --- custom pickup areas ----------------------------------------------------

const listCustomPickupAreasRoute = createRoute({
  method: "get",
  path: "/custom-pickup-areas",
  request: { query: customPickupAreaListQuerySchema },
  responses: {
    200: {
      description: "Paginated custom pickup areas",
      content: { "application/json": { schema: listResponseSchema(customPickupAreaSchema) } },
    },
  },
})

const createCustomPickupAreaRoute = createRoute({
  method: "post",
  path: "/custom-pickup-areas",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertCustomPickupAreaSchema } },
    },
  },
  responses: {
    201: {
      description: "The created custom pickup area",
      content: { "application/json": { schema: z.object({ data: customPickupAreaSchema }) } },
    },
    400: invalidRequestResponse,
  },
})

const batchUpdateCustomPickupAreasRoute = createRoute({
  method: "post",
  path: "/custom-pickup-areas/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdateCustomPickupAreaSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: {
        "application/json": { schema: batchUpdateResponseSchema(customPickupAreaSchema) },
      },
    },
    400: invalidRequestResponse,
  },
})

const batchDeleteCustomPickupAreasRoute = createRoute({
  method: "post",
  path: "/custom-pickup-areas/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: invalidRequestResponse,
  },
})

const getCustomPickupAreaRoute = createRoute({
  method: "get",
  path: "/custom-pickup-areas/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A custom pickup area by id",
      content: { "application/json": { schema: z.object({ data: customPickupAreaSchema }) } },
    },
    404: notFoundResponse("Custom pickup area not found"),
  },
})

const updateCustomPickupAreaRoute = createRoute({
  method: "patch",
  path: "/custom-pickup-areas/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateCustomPickupAreaSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated custom pickup area",
      content: { "application/json": { schema: z.object({ data: customPickupAreaSchema }) } },
    },
    400: invalidRequestResponse,
    404: notFoundResponse("Custom pickup area not found"),
  },
})

const deleteCustomPickupAreaRoute = createRoute({
  method: "delete",
  path: "/custom-pickup-areas/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Custom pickup area deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: notFoundResponse("Custom pickup area not found"),
  },
})

const customPickupAreaRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listCustomPickupAreasRoute, async (c) =>
    c.json(await availabilityService.listCustomPickupAreas(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createCustomPickupAreaRoute, async (c) => {
    const row = await availabilityService.createCustomPickupArea(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdateCustomPickupAreasRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: availabilityService.updateCustomPickupArea,
      }),
      200,
    )
  })
  .openapi(batchDeleteCustomPickupAreasRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: availabilityService.deleteCustomPickupArea,
      }),
      200,
    )
  })
  .openapi(getCustomPickupAreaRoute, async (c) => {
    const row = await availabilityService.getCustomPickupAreaById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Custom pickup area not found" }, 404)
  })
  .openapi(updateCustomPickupAreaRoute, async (c) => {
    const row = await availabilityService.updateCustomPickupArea(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Custom pickup area not found" }, 404)
  })
  .openapi(deleteCustomPickupAreaRoute, async (c) => {
    const row = await availabilityService.deleteCustomPickupArea(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Custom pickup area not found" }, 404)
  })

/**
 * Compose the per-resource sub-chains onto a single `OpenAPIHono` so the
 * `.openapi()` operations propagate up through the parent availability
 * registries (`OpenAPIHono.route` copies the sub-app's registered routes).
 */
export const availabilityPickupRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", pickupPointRoutes)
  .route("/", slotPickupRoutes)
  .route("/", meetingConfigRoutes)
  .route("/", pickupGroupRoutes)
  .route("/", pickupLocationRoutes)
  .route("/", locationPickupTimeRoutes)
  .route("/", customPickupAreaRoutes)
