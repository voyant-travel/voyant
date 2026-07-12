/**
 * Room-block admin routes. Mounted by the deployment under
 * `/v1/admin/accommodations` (so these resolve at
 * `/v1/admin/accommodations/room-blocks/*`). The accommodations module sets
 * `requiresTransactionalDb`, so the pickup/reversal/release mutations run on
 * the transactional DB. See RFC voyant#1489 §4.2/§8.
 *
 * Routes stay thin: validate input, call `roomBlockService`, serialize.
 *
 * Contract: authored as `@hono/zod-openapi` routes (voyant#2114). The request
 * bodies reuse the exported `validation-room-blocks` schemas; the response
 * schemas are authored here against the service return types (room-block /
 * pickup rows + the derived summary), with `Date`-origin columns serialized as
 * strings per api-route-authoring §17 — the wire shape, not the Drizzle row.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { ALLOTMENT_PICKUP_STATUSES, ALLOTMENT_STATUSES } from "@voyant-travel/allotments"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  createRoomBlock,
  getRoomBlock,
  pickupRoomBlock,
  releaseRoomBlockAtCutoff,
  reverseRoomBlockPickup,
  setRoomBlockNights,
  summarizeRoomBlock,
} from "./service-room-blocks.js"
import {
  createRoomBlockSchema,
  reverseRoomBlockPickupSchema,
  roomBlockPickupSchema,
  setRoomBlockNightsSchema,
} from "./validation-room-blocks.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

const errorResponseSchema = z.object({ error: z.string() })
const idParamSchema = z.object({ id: z.string() })

const jsonRecordSchema = z.record(z.string(), z.unknown())

/** DERIVED at read time from per-night counters — never a stored header value. */
const PICKUP_PROGRESS_VALUES = ["none", "partial", "full"] as const

/**
 * Wire shape of a `room_blocks` row. `optionDate`/`cutoffDate` are SQL `date`
 * columns and `createdAt`/`updatedAt` are timestamps — both serialize to
 * strings over the wire (§17), never `Date`.
 */
export const roomBlockSchema = z.object({
  id: z.string(),
  programId: z.string().nullable(),
  supplierId: z.string().nullable(),
  propertyId: z.string().nullable(),
  roomTypeId: z.string(),
  name: z.string(),
  status: z.enum(ALLOTMENT_STATUSES),
  currency: z.string(),
  netRateCents: z.number().int().nullable(),
  sellRateCents: z.number().int().nullable(),
  optionDate: z.string().nullable(),
  cutoffDate: z.string().nullable(),
  attritionTerms: jsonRecordSchema.nullable(),
  depositTerms: jsonRecordSchema.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecordSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/**
 * Wire shape of a `room_block_pickups` ledger row. `checkIn`/`checkOut` are
 * `date` columns and `pickedUpAt`/`reversedAt` are timestamps — strings over
 * the wire (§17).
 */
export const roomBlockPickupRowSchema = z.object({
  id: z.string(),
  blockId: z.string(),
  bookingId: z.string().nullable(),
  stayBookingItemId: z.string().nullable(),
  checkIn: z.string(),
  checkOut: z.string(),
  rooms: z.number().int(),
  status: z.enum(ALLOTMENT_PICKUP_STATUSES),
  pickedUpAt: z.string(),
  reversedAt: z.string().nullable(),
})

/** Derived ops view — counters + pickup progress for a block. */
export const roomBlockSummarySchema = z.object({
  blockId: z.string(),
  status: z.enum(ALLOTMENT_STATUSES),
  totalHeld: z.number().int(),
  totalPickedUp: z.number().int(),
  totalReleased: z.number().int(),
  totalRemaining: z.number().int(),
  pickupProgress: z.enum(PICKUP_PROGRESS_VALUES),
})

const roomBlockDetailResponseSchema = z.object({
  data: z.object({ block: roomBlockSchema, summary: roomBlockSummarySchema.nullable() }),
})
const roomBlockResponseSchema = z.object({ data: roomBlockSchema })
const roomBlockSummaryResponseSchema = z.object({ data: roomBlockSummarySchema.nullable() })
const roomBlockPickupResponseSchema = z.object({ data: roomBlockPickupRowSchema })
const roomBlockReleaseResponseSchema = z.object({
  data: z.object({ releasedRooms: z.number().int(), block: roomBlockSchema }),
})
const nightUnavailableResponseSchema = z.object({
  error: z.string(),
  detail: z.object({
    date: z.string(),
    remaining: z.number().int(),
    needed: z.number().int(),
  }),
})

const createRoomBlockRoute = createRoute({
  method: "post",
  path: "/room-blocks",
  "x-voyant-api-id": "@voyant-travel/accommodations#api",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createRoomBlockSchema } },
    },
  },
  responses: {
    201: {
      description: "The created room block (starts in `inquiry`; nights are set separately)",
      content: { "application/json": { schema: roomBlockResponseSchema } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getRoomBlockRoute = createRoute({
  method: "get",
  path: "/room-blocks/{id}",
  "x-voyant-api-id": "@voyant-travel/accommodations#api",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The room block header plus its derived pickup summary",
      content: { "application/json": { schema: roomBlockDetailResponseSchema } },
    },
    404: {
      description: "Room block not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const setRoomBlockNightsRoute = createRoute({
  method: "put",
  path: "/room-blocks/{id}/nights",
  "x-voyant-api-id": "@voyant-travel/accommodations#api",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      description:
        "Upsert the held inventory (and optional rate overrides) per night. Only " +
        "`roomsHeld` and the rate overrides are caller-controlled; the pickup / " +
        "release counters are owned by the lifecycle actions and never set here.",
      content: { "application/json": { schema: setRoomBlockNightsSchema } },
    },
  },
  responses: {
    200: {
      description: "The recomputed block summary after the nights upsert",
      content: { "application/json": { schema: roomBlockSummaryResponseSchema } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Room block not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const pickupRoomBlockRoute = createRoute({
  method: "post",
  path: "/room-blocks/{id}/pickups",
  "x-voyant-api-id": "@voyant-travel/accommodations#api",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      description:
        "Record a pickup against the block. Idempotent on `stayBookingItemId`: " +
        "re-processing the same stay item returns the existing active pickup with " +
        "a 200 instead of a 201.",
      content: { "application/json": { schema: roomBlockPickupSchema } },
    },
  },
  responses: {
    200: {
      description: "An existing active pickup (idempotent replay on `stayBookingItemId`)",
      content: { "application/json": { schema: roomBlockPickupResponseSchema } },
    },
    201: {
      description: "The newly recorded pickup",
      content: { "application/json": { schema: roomBlockPickupResponseSchema } },
    },
    400: {
      description: "Invalid check-in/check-out range",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Room block not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description:
        "The block is no longer accepting pickups, or a night has insufficient " +
        "inventory (the latter carries a `detail` with the short night)",
      content: {
        "application/json": {
          schema: z.union([errorResponseSchema, nightUnavailableResponseSchema]),
        },
      },
    },
  },
})

const reverseRoomBlockPickupRoute = createRoute({
  method: "post",
  path: "/room-blocks/{id}/pickups/reverse",
  "x-voyant-api-id": "@voyant-travel/accommodations#api",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      description:
        "Reverse a pickup (booking cancelled / rooms reduced). Exactly one of " +
        "`pickupId` or `stayBookingItemId` is required; the body schema enforces " +
        "this, so a request with neither (or both) fails request validation with a " +
        "400 `invalid_request`. A well-formed request whose pickup isn't found (or " +
        "belongs to a different block) returns 404.",
      content: { "application/json": { schema: reverseRoomBlockPickupSchema } },
    },
  },
  responses: {
    200: {
      description: "The reversed pickup ledger row",
      content: { "application/json": { schema: roomBlockPickupResponseSchema } },
    },
    400: {
      description: "Invalid body — neither (or both) of `pickupId`/`stayBookingItemId` supplied",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Active pickup not found (or it belongs to a different block)",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const releaseRoomBlockRoute = createRoute({
  method: "post",
  path: "/room-blocks/{id}/release",
  "x-voyant-api-id": "@voyant-travel/accommodations#api",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Unpicked rooms released back to the property; the block moves to `released`",
      content: { "application/json": { schema: roomBlockReleaseResponseSchema } },
    },
    404: {
      description: "Room block not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export const roomBlockAdminRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(createRoomBlockRoute, async (c) =>
    c.json({ data: await createRoomBlock(c.get("db"), c.req.valid("json")) }, 201),
  )
  .openapi(getRoomBlockRoute, async (c) => {
    const id = c.req.valid("param").id
    const block = await getRoomBlock(c.get("db"), id)
    if (!block) return c.json({ error: "Room block not found" }, 404)
    const summary = await summarizeRoomBlock(c.get("db"), id)
    return c.json({ data: { block, summary } }, 200)
  })
  .openapi(setRoomBlockNightsRoute, async (c) => {
    const id = c.req.valid("param").id
    const block = await getRoomBlock(c.get("db"), id)
    if (!block) return c.json({ error: "Room block not found" }, 404)
    const { nights } = c.req.valid("json")
    await setRoomBlockNights(c.get("db"), id, nights)
    return c.json({ data: await summarizeRoomBlock(c.get("db"), id) }, 200)
  })
  .openapi(pickupRoomBlockRoute, async (c) => {
    const body = c.req.valid("json")
    const outcome = await pickupRoomBlock(c.get("db"), {
      blockId: c.req.valid("param").id,
      ...body,
    })
    switch (outcome.status) {
      case "ok":
        return c.json({ data: outcome.pickup }, outcome.idempotent ? 200 : 201)
      case "block_not_found":
        return c.json({ error: "Room block not found" }, 404)
      case "invalid_range":
        return c.json({ error: "Invalid check-in/check-out range" }, 400)
      case "block_not_active":
        return c.json({ error: "Room block is no longer accepting pickups" }, 409)
      case "night_unavailable":
        return c.json(
          {
            error: "Insufficient inventory",
            detail: { date: outcome.date, remaining: outcome.remaining, needed: outcome.needed },
          },
          409,
        )
    }
  })
  .openapi(reverseRoomBlockPickupRoute, async (c) => {
    const body = c.req.valid("json")
    const outcome = await reverseRoomBlockPickup(c.get("db"), {
      blockId: c.req.valid("param").id,
      ...body,
    })
    if (outcome.status === "pickup_not_found") {
      return c.json({ error: "Active pickup not found" }, 404)
    }
    return c.json({ data: outcome.pickup }, 200)
  })
  .openapi(releaseRoomBlockRoute, async (c) => {
    const outcome = await releaseRoomBlockAtCutoff(c.get("db"), {
      blockId: c.req.valid("param").id,
    })
    if (outcome.status === "block_not_found") {
      return c.json({ error: "Room block not found" }, 404)
    }
    return c.json({ data: { releasedRooms: outcome.releasedRooms, block: outcome.block } }, 200)
  })

export type RoomBlockAdminRoutes = typeof roomBlockAdminRoutes
