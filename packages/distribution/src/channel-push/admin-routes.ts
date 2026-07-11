/**
 * Admin API for the channel-push operator dashboard.
 *
 * Ships the data layer for "channel sync" views per §9 + §10 (Phase D)
 * + §14.5 — operators want to see (a) which booking links are stuck,
 * (b) the delivery log per booking, (c) per-channel throttling, and
 * (d) a one-click retry button. The React surface lives in templates;
 * this file is the backing API.
 *
 * Routes are mounted under `/v1/admin/distribution/*`.
 *
 *   GET  /links              — counts + filterable list of channel_booking_links
 *   POST /retry/:bookingId   — drain pending links for one booking
 *   GET  /deliveries         — webhook_deliveries scoped by booking/channel
 *   GET  /throttling         — per-channel rate-limited count in last hour
 *   POST /reconcile/:flow    — manually trigger a reconciler scanner
 *
 * Per docs/architecture/channel-push-architecture.md §9 + §14.5.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import {
  type InfraWebhookDelivery,
  infraWebhookDeliveriesTable,
  infraWebhookDeliverySelectSchema,
} from "@voyant-travel/db/schema/infra"
import { openApiValidationHook } from "@voyant-travel/hono"
import { and, desc, eq, gte, sql } from "drizzle-orm"

import { channelBookingLinkSchema } from "../routes/openapi-schemas.js"
import { channelBookingLinks, channels } from "../schema.js"
import { channelKindSchema } from "../validation.js"
import { reconcileAvailability, reconcileBookingLinks, reconcileContent } from "./reconciler.js"
import { triggerBookingPushForBookingWithResult } from "./subscriber.js"
import type { ChannelPushDeps } from "./types.js"

type Env = {
  Variables: {
    db: ChannelPushDeps["db"]
    userId?: string
  }
}

const channelPushApiId = "@voyant-travel/distribution#channel-push-extension.api"
const errorResponseSchema = z.object({ error: z.string() })
const limitQuerySchema = z.string().optional()
const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { "application/json": { schema } },
})

const listLinksRoute = createRoute({
  method: "get",
  path: "/links",
  "x-voyant-api-id": channelPushApiId,
  request: {
    query: z.object({
      status: z.string().optional(),
      channelId: z.string().optional(),
      bookingId: z.string().optional(),
      limit: limitQuerySchema,
    }),
  },
  responses: {
    200: {
      description: "Channel booking links and status counts",
      ...jsonContent(
        z.object({
          data: z.array(
            z.object({
              link: channelBookingLinkSchema,
              channelName: z.string(),
              channelKind: channelKindSchema,
            }),
          ),
          counts: z.record(z.string(), z.number().int()),
        }),
      ),
    },
  },
})

const retryBookingRoute = createRoute({
  method: "post",
  path: "/retry/{bookingId}",
  "x-voyant-api-id": channelPushApiId,
  request: { params: z.object({ bookingId: z.string() }) },
  responses: {
    200: {
      description: "Booking push retry result",
      ...jsonContent(
        z.object({
          data: z.object({
            ok: z.boolean(),
            bookingId: z.string(),
            attempted: z.number().int(),
            succeeded: z.number().int(),
            failed: z.number().int(),
            compensated: z.number().int(),
            outcomes: z.array(
              z.object({
                channelId: z.string(),
                bookingItemId: z.string().nullable(),
                status: z.enum(["ok", "failed", "skipped", "compensated"]),
                upstreamRef: z.string().optional(),
                error: z.string().optional(),
              }),
            ),
            targetCount: z.number().int(),
            insertedLinks: z.number().int(),
            reason: z.enum(["no_pending_links", "booking_missing", "no_targets"]).optional(),
          }),
        }),
      ),
    },
    500: { description: "Booking push retry failed", ...jsonContent(errorResponseSchema) },
  },
})

const listDeliveriesRoute = createRoute({
  method: "get",
  path: "/deliveries",
  "x-voyant-api-id": channelPushApiId,
  request: {
    query: z.object({
      bookingId: z.string().optional(),
      channelId: z.string().optional(),
      limit: limitQuerySchema,
    }),
  },
  responses: {
    200: {
      description: "Channel push webhook deliveries",
      ...jsonContent(z.object({ data: z.array(infraWebhookDeliverySelectSchema) })),
    },
  },
})

const getThrottlingRoute = createRoute({
  method: "get",
  path: "/throttling",
  "x-voyant-api-id": channelPushApiId,
  request: { query: z.object({ sinceMs: z.string().optional() }) },
  responses: {
    200: {
      description: "Recent rate limiting by channel",
      ...jsonContent(
        z.object({
          data: z.array(z.object({ channelId: z.string(), count: z.number().int() })),
          sinceMs: z.number(),
        }),
      ),
    },
  },
})

const reconcileRoute = createRoute({
  method: "post",
  path: "/reconcile/{flow}",
  "x-voyant-api-id": channelPushApiId,
  request: { params: z.object({ flow: z.string() }) },
  responses: {
    200: {
      description: "Channel push reconciliation result",
      ...jsonContent(
        z.object({
          data: z.object({ scanned: z.number().int(), triggered: z.number().int() }),
        }),
      ),
    },
    400: { description: "Unknown channel push flow", ...jsonContent(errorResponseSchema) },
    500: { description: "Channel push reconciliation failed", ...jsonContent(errorResponseSchema) },
  },
})

export type ChannelPushAdminRoutes = ReturnType<typeof createChannelPushAdminRoutes>

export function createChannelPushAdminRoutes() {
  const app = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })

  // ── GET /links ───────────────────────────────────────────────────
  // Status counts + filterable list of channel_booking_links. The
  // dashboard's "channel sync" view consumes this for both the summary
  // tiles ("X pending, Y failed, Z compensated") and the row table.
  app.openapi(listLinksRoute, async (c) => {
    const db = c.get("db")
    const status = c.req.query("status")
    const channelId = c.req.query("channelId")
    const bookingId = c.req.query("bookingId")
    const limit = clampLimit(c.req.query("limit"))

    const filters = [
      status ? eq(channelBookingLinks.pushStatus, status) : sql`true`,
      channelId ? eq(channelBookingLinks.channelId, channelId) : sql`true`,
      bookingId ? eq(channelBookingLinks.bookingId, bookingId) : sql`true`,
    ]

    const rows = await db
      .select({
        link: channelBookingLinks,
        channelName: channels.name,
        channelKind: channels.kind,
      })
      .from(channelBookingLinks)
      .innerJoin(channels, eq(channelBookingLinks.channelId, channels.id))
      .where(and(...filters))
      .orderBy(desc(channelBookingLinks.lastPushAt), desc(channelBookingLinks.createdAt))
      .limit(limit)

    const counts = await db
      .select({
        status: channelBookingLinks.pushStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(channelBookingLinks)
      .where(and(...filters))
      .groupBy(channelBookingLinks.pushStatus)

    return c.json({
      data: rows,
      counts: Object.fromEntries(counts.map((c) => [c.status, c.count])),
    })
  })

  // ── POST /retry/:bookingId ───────────────────────────────────────
  // Operator-driven retry. Re-resolves push targets, upserts pending
  // intent rows, and runs processBookingPush inline. Idempotent on
  // the booking_links unique constraint, so accidental double-clicks
  // are safe.
  app.openapi(retryBookingRoute, async (c) => {
    const bookingId = c.req.param("bookingId")
    try {
      const result = await triggerBookingPushForBookingWithResult(bookingId)
      const processedLinks = result.attempted > 0
      const ok = processedLinks && result.reason !== "booking_missing"
      return c.json({ data: { ok, ...result } }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // ── GET /deliveries ──────────────────────────────────────────────
  // Drilldown view: every webhook_deliveries row scoped to a booking,
  // channel, or both. Used by the "show me what we sent" link in the
  // dashboard's failure rows.
  app.openapi(listDeliveriesRoute, async (c) => {
    const db = c.get("db")
    const bookingId = c.req.query("bookingId")
    const channelId = c.req.query("channelId")
    const limit = clampLimit(c.req.query("limit"))

    const filters = [
      eq(infraWebhookDeliveriesTable.sourceModule, "distribution"),
      bookingId
        ? and(
            eq(infraWebhookDeliveriesTable.sourceEntityModule, "bookings"),
            eq(infraWebhookDeliveriesTable.sourceEntityId, bookingId),
          )
        : sql`true`,
      channelId ? eq(infraWebhookDeliveriesTable.targetRef, channelId) : sql`true`,
    ]

    const rows = (await db
      .select()
      .from(infraWebhookDeliveriesTable)
      .where(and(...filters))
      .orderBy(desc(infraWebhookDeliveriesTable.createdAt))
      .limit(limit)) as InfraWebhookDelivery[]

    return c.json({ data: rows })
  })

  // ── GET /throttling ──────────────────────────────────────────────
  // Per-channel rate-limited count in the last hour. The dashboard
  // shows a yellow "throttled" badge when any channel has > 0
  // rate_limited rows in the window. Per §14.5.
  app.openapi(getThrottlingRoute, async (c) => {
    const db = c.get("db")
    const sinceMs = Number.parseInt(c.req.query("sinceMs") ?? String(60 * 60 * 1000), 10)
    const since = new Date(Date.now() - (Number.isFinite(sinceMs) ? sinceMs : 60 * 60 * 1000))

    const rows = await db
      .select({
        channelId: infraWebhookDeliveriesTable.targetRef,
        count: sql<number>`count(*)::int`,
      })
      .from(infraWebhookDeliveriesTable)
      .where(
        and(
          eq(infraWebhookDeliveriesTable.sourceModule, "distribution"),
          eq(infraWebhookDeliveriesTable.errorClass, "rate_limited"),
          gte(infraWebhookDeliveriesTable.createdAt, since),
        ),
      )
      .groupBy(infraWebhookDeliveriesTable.targetRef)

    return c.json({
      data: rows
        .filter((row): row is typeof row & { channelId: string } => row.channelId != null)
        .map((row) => ({ channelId: row.channelId, count: row.count })),
      sinceMs,
    })
  })

  // ── POST /reconcile/:flow ────────────────────────────────────────
  // Manual reconciler trigger for ops — useful when a channel comes
  // back up after a long outage and you don't want to wait for the
  // next scheduled run. `flow` is one of "bookings", "availability",
  // "content".
  app.openapi(reconcileRoute, async (c) => {
    const flow = c.req.param("flow")
    try {
      switch (flow) {
        case "bookings": {
          const result = await reconcileBookingLinks({})
          return c.json({ data: result }, 200)
        }
        case "availability": {
          const result = await reconcileAvailability({})
          return c.json({ data: result }, 200)
        }
        case "content": {
          const result = await reconcileContent({})
          return c.json({ data: result }, 200)
        }
        default:
          return c.json({ error: `unknown flow "${flow}"` }, 400)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  return app
}

function clampLimit(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : 50
  if (!Number.isFinite(parsed) || parsed <= 0) return 50
  return Math.min(parsed, 500)
}
