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

import {
  type InfraWebhookDelivery,
  infraWebhookDeliveriesTable,
} from "@voyant-travel/db/schema/infra"
import { and, desc, eq, gte, sql } from "drizzle-orm"
import { Hono } from "hono"

import { channelBookingLinks, channels } from "../schema.js"
import { reconcileAvailability, reconcileBookingLinks, reconcileContent } from "./reconciler.js"
import { triggerBookingPushForBookingWithResult } from "./subscriber.js"
import type { ChannelPushDeps } from "./types.js"

type Env = {
  Variables: {
    db: ChannelPushDeps["db"]
    userId?: string
  }
}

export type ChannelPushAdminRoutes = ReturnType<typeof createChannelPushAdminRoutes>

export function createChannelPushAdminRoutes() {
  const app = new Hono<Env>()

  // ── GET /links ───────────────────────────────────────────────────
  // Status counts + filterable list of channel_booking_links. The
  // dashboard's "channel sync" view consumes this for both the summary
  // tiles ("X pending, Y failed, Z compensated") and the row table.
  app.get("/links", async (c) => {
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
  app.post("/retry/:bookingId", async (c) => {
    const bookingId = c.req.param("bookingId")
    try {
      const result = await triggerBookingPushForBookingWithResult(bookingId)
      const processedLinks = result.attempted > 0
      const ok = processedLinks && result.reason !== "booking_missing"
      return c.json({ data: { ok, ...result } })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // ── GET /deliveries ──────────────────────────────────────────────
  // Drilldown view: every webhook_deliveries row scoped to a booking,
  // channel, or both. Used by the "show me what we sent" link in the
  // dashboard's failure rows.
  app.get("/deliveries", async (c) => {
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
  app.get("/throttling", async (c) => {
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
      data: rows.filter((r) => r.channelId != null),
      sinceMs,
    })
  })

  // ── POST /reconcile/:flow ────────────────────────────────────────
  // Manual reconciler trigger for ops — useful when a channel comes
  // back up after a long outage and you don't want to wait for the
  // next scheduled run. `flow` is one of "bookings", "availability",
  // "content".
  app.post("/reconcile/:flow", async (c) => {
    const flow = c.req.param("flow")
    try {
      switch (flow) {
        case "bookings": {
          const result = await reconcileBookingLinks({})
          return c.json({ data: result })
        }
        case "availability": {
          const result = await reconcileAvailability({})
          return c.json({ data: result })
        }
        case "content": {
          const result = await reconcileContent({})
          return c.json({ data: result })
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
