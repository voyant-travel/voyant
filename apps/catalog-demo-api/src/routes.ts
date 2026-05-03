/**
 * REST surface for the catalog demo service. Mirrors the methods on
 * `SourceAdapter` (`@voyantjs/catalog/adapter/contract`) so the plugin
 * (`@voyantjs/plugin-catalog-demo`) is a thin fetch wrapper.
 *
 *   POST   /discover                   discover (paginated CatalogProjections)
 *   POST   /live-resolve               liveResolve (current price + availability)
 *   POST   /reserve                    reserve (creates a demo order)
 *   POST   /cancel                     cancel (flips order status)
 *   GET    /inventory                  list current inventory rows
 *   POST   /inventory/seed             seed default inventory (idempotent)
 *   GET    /orders/:id                 read a single order — debug surface
 *   GET    /health                     liveness probe
 *
 * The `*` endpoints emit JSON bodies that match the `SourceAdapter`
 * contract's return shapes. Errors come back as `{ "error": message }`
 * with appropriate HTTP statuses.
 */

import type {
  CatalogProjection,
  DiscoveryPage,
  LiveResolveRequest,
  LiveResolveResult,
  ReserveRequest,
  ReserveResult,
} from "@voyantjs/catalog"
import { Hono } from "hono"

import type { CatalogDemoDb } from "./db.js"
import { defaultDemoInventory, seedInventory } from "./seed.js"
import * as store from "./store.js"

interface DiscoverBody {
  cursor?: string
  limit?: number
  entityModules?: string[]
}

interface CancelBody {
  upstream_ref: string
  reason?: string
}

const SOURCE_KIND = "demo"

export function createRoutes(db: CatalogDemoDb): Hono {
  const app = new Hono()

  app.get("/health", (c) => c.json({ ok: true, service: "catalog-demo-api" }))

  // ── Discover ──────────────────────────────────────────────────────────
  app.post("/discover", async (c) => {
    let body: DiscoverBody
    try {
      body = await c.req.json<DiscoverBody>()
    } catch {
      body = {}
    }
    const result = await store.listInventory(db, {
      cursor: body.cursor,
      limit: body.limit,
      entityModules: body.entityModules,
    })
    const projections: CatalogProjection[] = result.rows.map((row) => ({
      entity_module: row.entityModule,
      entity_id: row.id,
      provenance: {
        source_kind: SOURCE_KIND,
        source_freshness: "sync",
        source_ref: row.id,
      },
      fields: {
        "source.kind": SOURCE_KIND,
        "source.ref": row.id,
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.available > 0 ? "active" : "inactive",
        activated: row.available > 0,
        visibility: "public",
        sellAmountCents: row.priceCents,
        sellCurrency: row.currency,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    }))
    const page: DiscoveryPage = {
      projections,
      next_cursor: result.nextCursor,
    }
    return c.json(page)
  })

  // ── Live resolve ──────────────────────────────────────────────────────
  app.post("/live-resolve", async (c) => {
    let body: LiveResolveRequest
    try {
      body = await c.req.json<LiveResolveRequest>()
    } catch {
      return c.json({ error: "invalid json body" }, 400)
    }
    if (!Array.isArray(body?.ids)) {
      return c.json({ error: "ids array is required" }, 400)
    }

    const inventory = await store.getInventoryByIds(db, body.ids)
    const values: Record<string, Record<string, unknown>> = {}
    const failed: Record<string, "timeout" | "not_found" | "unsupported" | "error"> = {}
    for (const id of body.ids) {
      const row = inventory.get(id)
      if (!row || row.available <= 0) {
        failed[id] = "not_found"
        continue
      }
      values[id] = {
        available: true,
        priceCents: row.priceCents,
        currency: row.currency,
        name: row.name,
        metadata: row.metadata ?? null,
      }
    }
    const result: LiveResolveResult =
      Object.keys(failed).length > 0 ? { values, failed } : { values }
    return c.json(result)
  })

  // ── Reserve ───────────────────────────────────────────────────────────
  app.post("/reserve", async (c) => {
    let body: ReserveRequest
    try {
      body = await c.req.json<ReserveRequest>()
    } catch {
      return c.json({ error: "invalid json body" }, 400)
    }
    if (!body?.entity_id) {
      return c.json({ error: "entity_id is required" }, 400)
    }

    const inventory = await store.getInventoryByIds(db, [body.entity_id])
    const row = inventory.get(body.entity_id)
    if (!row || row.available <= 0) {
      const result: ReserveResult = {
        upstream_ref: "",
        status: "failed",
        upstream_payload: { reason: "inventory_unavailable", entityId: body.entity_id },
      }
      return c.json(result)
    }

    const intentType = readIntentType(body.payment_intent)
    const orderStatus = intentType === "hold" ? "held" : "confirmed"

    const order = await store.createOrder(db, {
      inventoryId: row.id,
      entityId: row.id,
      entityModule: row.entityModule,
      status: orderStatus,
      pricedCents: row.priceCents,
      currency: row.currency,
      party: body.party ?? null,
      paymentIntent: body.payment_intent ?? null,
    })
    await store.decrementAvailability(db, row.id)

    const result: ReserveResult = {
      upstream_ref: order.id,
      status: orderStatus === "held" ? "held" : "confirmed",
      upstream_payload: {
        orderId: order.id,
        inventoryId: row.id,
        pricedCents: row.priceCents,
        currency: row.currency,
      },
    }
    return c.json(result)
  })

  // ── Cancel ────────────────────────────────────────────────────────────
  app.post("/cancel", async (c) => {
    let body: CancelBody
    try {
      body = await c.req.json<CancelBody>()
    } catch {
      return c.json({ error: "invalid json body" }, 400)
    }
    if (!body?.upstream_ref) {
      return c.json({ error: "upstream_ref is required" }, 400)
    }

    const order = await store.getOrder(db, body.upstream_ref)
    if (!order) {
      return c.json({ status: "refused" })
    }
    if (order.status === "cancelled") {
      return c.json({
        status: "cancelled",
        refund_amount: order.pricedCents,
        refund_currency: order.currency,
      })
    }

    const cancelled = await store.markOrderCancelled(db, order.id, body.reason ?? null)
    if (cancelled?.inventoryId) {
      await store.incrementAvailability(db, cancelled.inventoryId)
    }
    return c.json({
      status: "cancelled",
      refund_amount: order.pricedCents,
      refund_currency: order.currency,
    })
  })

  // ── Admin / debug surfaces ────────────────────────────────────────────
  app.get("/inventory", async (c) => {
    const url = new URL(c.req.url)
    const cursor = url.searchParams.get("cursor") ?? undefined
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10)
    const result = await store.listInventory(db, {
      cursor,
      limit: Number.isFinite(limit) ? limit : 50,
    })
    return c.json({
      rows: result.rows,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { cursor: result.nextCursor } : {}),
    })
  })

  app.post("/inventory/seed", async (c) => {
    const rows = await seedInventory(db, defaultDemoInventory)
    return c.json({ count: rows.length, rows })
  })

  app.get("/orders/:id", async (c) => {
    const order = await store.getOrder(db, c.req.param("id"))
    if (!order) return c.json({ error: "order not found" }, 404)
    return c.json(order)
  })

  return app
}

function readIntentType(intent: ReserveRequest["payment_intent"]): string | undefined {
  if (!intent || typeof intent !== "object") return undefined
  const t = (intent as Record<string, unknown>).type
  return typeof t === "string" ? t : undefined
}
