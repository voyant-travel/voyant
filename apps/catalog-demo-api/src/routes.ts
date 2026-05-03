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
  GetContentRequest,
  GetContentResult,
  LiveResolveRequest,
  LiveResolveResult,
  ReserveRequest,
  ReserveResult,
} from "@voyantjs/catalog"
import { Hono } from "hono"

import type { CatalogDemoDb } from "./db.js"
import { buildDefaultDemoInventory, seedInventory } from "./seed.js"
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
/**
 * Synthetic supplier identifier the demo upstream stamps on every
 * projection. Doesn't resolve in the operator's own `suppliers` table,
 * so the catalog UI's `formatSupplier` lookup falls through to the raw
 * value — which is the intentional outcome: a fresh deployment sees
 * "Demo Tours" verbatim and operators wiring a real adapter would map
 * the upstream id to a local supplier row.
 */
const DEMO_SUPPLIER_ID = "Demo Tours"

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
        // Demo upstream models its rows as operated by a single brand. A real
        // adapter (TUI direct, Voyant Connect peer) emits the upstream's
        // own supplier identifier; the operator maps it to a local
        // suppliers row at integration time.
        supplierId: DEMO_SUPPLIER_ID,
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
    const requestedDepartureId = readDepartureId(body.parameters)
    const values: Record<string, Record<string, unknown>> = {}
    const failed: Record<string, "timeout" | "not_found" | "unsupported" | "error"> = {}
    for (const id of body.ids) {
      const row = inventory.get(id)
      if (!row || row.available <= 0) {
        failed[id] = "not_found"
        continue
      }
      let departure: ReturnType<typeof findDeparture> = null
      if (requestedDepartureId) {
        departure = findDeparture(row.metadata, requestedDepartureId)
        if (!departure) {
          // Slot wasn't found in the upstream's current schedule — probably
          // expired or rotated out. Surfaces as "invalid_reason: not_found"
          // on the quote so the operator can re-pick.
          failed[id] = "not_found"
          continue
        }
        if (
          departure.status === "sold_out" ||
          departure.status === "closed" ||
          departure.status === "cancelled"
        ) {
          failed[id] = "not_found"
          continue
        }
      }
      const slotPrice = departure?.lowest_price_cents ?? row.priceCents
      const slotCurrency = departure?.currency ?? row.currency
      values[id] = {
        available: true,
        priceCents: slotPrice,
        currency: slotCurrency,
        name: row.name,
        metadata: row.metadata ?? null,
        ...(departure
          ? {
              departure: {
                id: departure.id,
                starts_at: departure.starts_at,
                ends_at: departure.ends_at ?? null,
                priceCents: slotPrice,
                currency: slotCurrency,
              },
            }
          : {}),
      }
    }
    const result: LiveResolveResult =
      Object.keys(failed).length > 0 ? { values, failed } : { values }
    return c.json(result)
  })

  // ── Get content ───────────────────────────────────────────────────────
  // Rich detail endpoint mirrored on the SourceAdapter contract's
  // `getContent` method (sourced-content §3.1). The demo-api stores
  // rich content (highlights, days, options, media, policies) on
  // `inventory.metadata`; this route projects that into a
  // products/v1 ProductContent payload. Real upstream adapters return
  // their own getContent shapes here.
  app.post("/get-content", async (c) => {
    let body: GetContentRequest
    try {
      body = await c.req.json<GetContentRequest>()
    } catch {
      return c.json({ error: "invalid json body" }, 400)
    }
    if (!body?.entity_id) {
      return c.json({ error: "entity_id is required" }, 400)
    }
    const inventory = await store.getInventoryByIds(db, [body.entity_id])
    const row = inventory.get(body.entity_id)
    if (!row) {
      return c.json({ error: "not_found" }, 404)
    }
    const meta = (row.metadata ?? {}) as Record<string, unknown>
    const heroImageUrl = stringOr(meta.heroImageUrl, null)
    const highlights = stringArrayOr(meta.highlights, [])
    const tags = stringArrayOr(meta.tags, [])
    const days = mapArray(meta.days, (d) => ({
      day_number: numberOr((d as Record<string, unknown>).dayNumber, 1) ?? 1,
      title: stringOr((d as Record<string, unknown>).title, null),
      description: stringOr((d as Record<string, unknown>).description, null),
      location: stringOr((d as Record<string, unknown>).location, null),
      services: [],
    }))
    const options = mapArray(meta.options, (o) => ({
      id: stringOr((o as Record<string, unknown>).id, "opt") ?? "opt",
      name: stringOr((o as Record<string, unknown>).name, "Option") ?? "Option",
      description: stringOr((o as Record<string, unknown>).description, null),
      units: [],
      inclusions: [],
    }))
    const baseMedia = heroImageUrl
      ? [{ url: heroImageUrl, type: "image" as const, caption: null, alt: null }]
      : []
    const extraMedia = mapArray(meta.media, (m) => ({
      url: stringOr((m as Record<string, unknown>).url, "") ?? "",
      type: (stringOr((m as Record<string, unknown>).type, "image") ?? "image") as
        | "image"
        | "video"
        | "document",
      caption: stringOr((m as Record<string, unknown>).caption, null),
      alt: stringOr((m as Record<string, unknown>).alt, null),
    })).filter((m) => m.url.length > 0)
    const media = [...baseMedia, ...extraMedia]
    const policies: Array<{
      kind: "cancellation" | "payment" | "supplier_notes" | "requirements"
      body: string
    }> = []
    const cancel = stringOr(meta.cancellationPolicy, null)
    if (cancel) policies.push({ kind: "cancellation", body: cancel })
    const payment = stringOr(meta.paymentTerms, null)
    if (payment) policies.push({ kind: "payment", body: payment })
    const supplierNotes = stringOr(meta.supplierNotes, null)
    if (supplierNotes) policies.push({ kind: "supplier_notes", body: supplierNotes })

    const departures = mapArray(meta.departures, (d) => {
      const dr = d as Record<string, unknown>
      return {
        id: stringOr(dr.id, "") ?? "",
        starts_at: stringOr(dr.starts_at, "") ?? "",
        ends_at: stringOr(dr.ends_at, null),
        status: stringOr(dr.status, null),
        capacity: numberOr(dr.capacity, null),
        remaining: numberOr(dr.remaining, null),
        lowest_price_cents: numberOr(dr.lowest_price_cents, row.priceCents),
        currency: stringOr(dr.currency, row.currency),
        note: stringOr(dr.note, null),
      }
    }).filter((d) => d.id.length > 0 && d.starts_at.length > 0)

    const content = {
      product: {
        id: row.id,
        name: row.name,
        status: row.available > 0 ? "active" : "inactive",
        description: row.description ?? null,
        highlights,
        hero_image_url: heroImageUrl,
        duration_days: numberOr(meta.durationDays, null),
        sell_currency: row.currency,
        supplier: DEMO_SUPPLIER_ID,
        country: stringOr(meta.country, null),
        departure_city: stringOr(meta.departureCity, null),
        tags,
      },
      options,
      days,
      media,
      policies,
      departures,
    }

    const result: GetContentResult = {
      entity_module: body.entity_module,
      entity_id: body.entity_id,
      source_ref: row.id,
      returned_locale: body.locale,
      content,
      content_schema_version: "products/v1",
      source_updated_at: row.updatedAt,
    }
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

    const requestedDepartureId = readDepartureId(body.parameters)
    let departure: ReturnType<typeof findDeparture> = null
    if (requestedDepartureId) {
      departure = findDeparture(row.metadata, requestedDepartureId)
      if (!departure) {
        const result: ReserveResult = {
          upstream_ref: "",
          status: "failed",
          upstream_payload: { reason: "departure_not_found", departureId: requestedDepartureId },
        }
        return c.json(result)
      }
    }

    const intentType = readIntentType(body.payment_intent)
    const orderStatus = intentType === "hold" ? "held" : "confirmed"
    const slotPrice = departure?.lowest_price_cents ?? row.priceCents
    const slotCurrency = departure?.currency ?? row.currency

    const order = await store.createOrder(db, {
      inventoryId: row.id,
      entityId: row.id,
      entityModule: row.entityModule,
      status: orderStatus,
      pricedCents: slotPrice,
      currency: slotCurrency,
      party: body.party ?? null,
      paymentIntent: body.payment_intent ?? null,
      parameters: body.parameters ?? null,
    })
    await store.decrementAvailability(db, row.id)

    const result: ReserveResult = {
      upstream_ref: order.id,
      status: orderStatus === "held" ? "held" : "confirmed",
      upstream_payload: {
        orderId: order.id,
        inventoryId: row.id,
        pricedCents: slotPrice,
        currency: slotCurrency,
        ...(departure
          ? {
              departure: {
                id: departure.id,
                starts_at: departure.starts_at,
                ends_at: departure.ends_at ?? null,
              },
            }
          : {}),
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
    const rows = await seedInventory(db, buildDefaultDemoInventory())
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

// ─────────────────────────────────────────────────────────────────────────────
// Tiny field-pickers for /get-content. Demo metadata is free-form JSON;
// these guard against the operator hand-editing rows in the demo DB.
// ─────────────────────────────────────────────────────────────────────────────

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === "string" && value.length > 0 ? value : fallback
}

function numberOr<T>(value: unknown, fallback: T): number | T {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function stringArrayOr(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  const out = value.filter((v): v is string => typeof v === "string")
  return out.length > 0 ? out : fallback
}

function mapArray<T>(value: unknown, project: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) return []
  return value.map(project)
}

function readDepartureId(parameters: Record<string, unknown> | undefined): string | null {
  const raw = parameters?.departure_id
  return typeof raw === "string" && raw.length > 0 ? raw : null
}

interface DemoDeparture {
  id: string
  starts_at: string
  ends_at?: string | null
  status?: string | null
  lowest_price_cents?: number
  currency?: string
}

function findDeparture(
  metadata: Record<string, unknown> | null | undefined,
  departureId: string,
): DemoDeparture | null {
  const list = metadata && Array.isArray(metadata.departures) ? metadata.departures : []
  for (const d of list) {
    if (d && typeof d === "object" && (d as Record<string, unknown>).id === departureId) {
      const r = d as Record<string, unknown>
      return {
        id: departureId,
        starts_at: typeof r.starts_at === "string" ? r.starts_at : "",
        ends_at: typeof r.ends_at === "string" ? r.ends_at : null,
        status: typeof r.status === "string" ? r.status : null,
        lowest_price_cents:
          typeof r.lowest_price_cents === "number" ? r.lowest_price_cents : undefined,
        currency: typeof r.currency === "string" ? r.currency : undefined,
      }
    }
  }
  return null
}
