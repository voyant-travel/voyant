/**
 * Flight search + reference-data + booking routes for the operator admin UI.
 *
 * agent-quality: file-size exception -- Flight adapter routes stay co-located while search, ancillary, booking, and payment-link behavior share provider runtime helpers.
 *
 *   POST   /v1/admin/flights/search                      — adapter searchFlights
 *   POST   /v1/admin/flights/ancillaries                 — adapter getAncillaries
 *   POST   /v1/admin/flights/seatmap                     — adapter getSeatMap
 *   POST   /v1/admin/flights/price                       — adapter priceOffer
 *   POST   /v1/admin/flights/book                        — adapter bookFlight
 *   GET    /v1/admin/flights/orders/:orderId             — adapter getOrder
 *   POST   /v1/admin/flights/orders/:orderId/cancel      — adapter cancelOrder
 *   GET    /v1/admin/flights/reference/airports?q=&limit=
 *   GET    /v1/admin/flights/reference/airlines
 *   GET    /v1/admin/flights/reference/aircraft
 *
 * The adapter is the demo `createDemoFlightAdapter()` for now; swapping
 * to a real connector (Sabre / Amadeus / Duffel) is a single-line change
 * here once a connection is configured.
 */

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { financeService } from "@voyant-travel/finance"
import { paymentSessions } from "@voyant-travel/finance/schema"
import type {
  FlightCancelReason,
  FlightPriceRequest,
} from "@voyant-travel/flights/contract/adapter"
import type {
  AncillaryRequest,
  FlightBookRequest,
  FlightOrder,
  FlightOrderStatus,
  FlightPassenger,
  FlightSearchRequest,
  SeatMapRequest,
} from "@voyant-travel/flights/contract/types"
import {
  referenceAircraft,
  referenceAirlines,
  referenceAirports,
} from "@voyant-travel/flights/reference/local-postgres"
import { createDemoFlightAdapter } from "@voyant-travel/plugin-flights-demo"
import {
  NETOPIA_RUNTIME_CONTAINER_KEY,
  netopiaService,
  type ResolvedNetopiaRuntimeOptions,
} from "@voyant-travel/plugin-netopia"
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm"
import { type Context, Hono } from "hono"

/**
 * Resolve the flight connector adapter for this request. The demo adapter
 * is a thin HTTP client to `apps/flights-demo-api` (set
 * `FLIGHTS_DEMO_API_URL` in `.dev.vars`). Swapping to a real GDS connector
 * is a one-line change here.
 */
function getAdapter(c: Context) {
  const baseUrl = (c.env as { FLIGHTS_DEMO_API_URL?: string }).FLIGHTS_DEMO_API_URL
  if (!baseUrl) {
    throw new Error(
      "FLIGHTS_DEMO_API_URL is not set. Start `apps/flights-demo-api` and point this env at it (e.g. http://localhost:3320).",
    )
  }
  return createDemoFlightAdapter({ baseUrl })
}

function buildContext(c: Context): {
  connectionId: string
  correlationId?: string
} {
  return {
    connectionId: "demo",
    correlationId: c.req.header("x-request-id") ?? undefined,
  }
}

// `c.var.db` is set by the createApp DB middleware; the global ContextVariableMap
// doesn't declare it, so cast at the call site to keep type-safety local.
function getDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
}

/**
 * Ensure a finance `payment_session` exists for this hold-state flight order
 * and return the shareable landing URL so the operator can copy/send it.
 *
 * Idempotent: looks up by `clientReference = orderId` first; only creates +
 * starts the Netopia provider when no session exists yet. Uses synthesized
 * placeholder billing — the customer overrides it on Netopia's hosted form.
 *
 * Called from both `book` (so the link appears immediately) and `getOrder`
 * (so the order page sees it on subsequent visits even though the flight
 * adapter doesn't persist `providerData` between calls).
 */
async function ensureFlightOrderPaymentSession(
  c: Context,
  order: FlightOrder,
  contact: { email?: string; phone?: string } | undefined,
): Promise<PaymentSessionSummary | null> {
  const db = getDb(c) as Parameters<typeof financeService.createPaymentSession>[0]
  const passengerForBilling = order.passengers[0]
  if (!passengerForBilling) return null

  // 1. Look up existing session(s) for this order via targetId+targetType
  //    (clientReference is unreliable — retry sessions intentionally don't
  //    set it to avoid Netopia "already processed" errors). Prefer the
  //    most recent non-terminal session so the operator UI surfaces a
  //    *live* link, not a dead failed/expired/cancelled one.
  const existing = await db
    .select()
    .from(paymentSessions)
    .where(
      and(
        eq(paymentSessions.targetId, order.orderId),
        eq(paymentSessions.targetType, "flight_order"),
      ),
    )
    .orderBy(desc(paymentSessions.createdAt))
  const live = existing.find((row) => !["failed", "expired", "cancelled"].includes(row.status))
  if (live) return { sessionId: live.id, status: live.status }
  // No live session — if there's a paid/failed history at all, surface the
  // most recent so the operator UI can still show its status (e.g. "Failed"
  // before the user clicks Try again to mint a fresh one).
  const latest = existing[0]
  if (latest && ["paid", "authorized"].includes(latest.status)) {
    return { sessionId: latest.id, status: latest.status }
  }

  // 2. Create the session (currency + amount come from the order).
  const amountCents = parseAmountToCents(order.totalPrice.amount)
  if (amountCents <= 0) return null

  const session = await financeService.createPaymentSession(db, {
    targetType: "flight_order",
    targetId: order.orderId,
    // clientReference is intentionally unset — Netopia uses it to derive
    // its `orderID`, and we want each session to get a fresh orderID
    // (session.id, by fallback) so retries aren't rejected as duplicates.
    // Lookup by `targetId` + `targetType` covers the operator-side needs.
    currency: order.totalPrice.currency,
    amountCents,
    status: "pending",
    provider: "netopia",
    paymentMethod: "credit_card",
    payerEmail: contact?.email ?? passengerForBilling.email ?? null,
    payerName: `${passengerForBilling.firstName} ${passengerForBilling.lastName}`.trim(),
    notes: buildFlightSummary(order),
  })

  // 3. Start Netopia so `redirectUrl` is populated for the landing page's
  //    "Pay by card" tab. Placeholder billing is overwritten on the hosted
  //    form — Netopia treats it as a default the customer confirms.
  try {
    const runtime = c.var.container?.resolve(NETOPIA_RUNTIME_CONTAINER_KEY) as
      | ResolvedNetopiaRuntimeOptions
      | undefined
    if (runtime) {
      await netopiaService.startPaymentSession(
        db,
        session.id,
        {
          billing: synthesizeBilling(passengerForBilling, contact),
          description: `Flight ${order.orderId}`,
        },
        runtime,
        undefined,
      )
    }
  } catch (err) {
    // Netopia start is best-effort — if it fails (e.g. NETOPIA_* env not
    // configured), the bank-transfer tab still works on the landing page.
    console.warn("[flights] netopia start failed for hold session:", err)
  }

  return { sessionId: session.id, status: session.status }
}

function parseAmountToCents(amount: string): number {
  const n = Number.parseFloat(amount)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

function synthesizeBilling(
  pax: FlightPassenger,
  contact: { email?: string; phone?: string } | undefined,
) {
  return {
    email: contact?.email ?? pax.email ?? "tbd@example.com",
    phone: contact?.phone ?? pax.phone ?? "0000000000",
    firstName: pax.firstName,
    lastName: pax.lastName,
    city: "TBD",
    country: 642, // ISO 3166-1 numeric — Romania default; customer overrides on hosted form.
    state: "TBD",
    postalCode: "00000",
    details: "Pending — customer to confirm at payment.",
  }
}

interface PaymentSessionSummary {
  sessionId: string
  status: string
}

/**
 * Bulk-fetch the most relevant payment session for each flight order id —
 * one query, indexed by `targetId`. Same precedence as
 * `ensureFlightOrderPaymentSession`'s lookup: prefer non-terminal sessions,
 * fall back to paid history, ignore the rest.
 */
async function fetchPaymentSessionsByOrderIds(
  c: Context,
  orderIds: string[],
): Promise<Map<string, { id: string; status: string }>> {
  const result = new Map<string, { id: string; status: string }>()
  if (orderIds.length === 0) return result
  const db = getDb(c)
  const rows = await db
    .select({
      id: paymentSessions.id,
      targetId: paymentSessions.targetId,
      status: paymentSessions.status,
      createdAt: paymentSessions.createdAt,
    })
    .from(paymentSessions)
    .where(
      and(
        eq(paymentSessions.targetType, "flight_order"),
        inArray(paymentSessions.targetId, orderIds),
      ),
    )
    .orderBy(desc(paymentSessions.createdAt))

  // First pass — record any non-terminal session per order (most recent wins).
  for (const row of rows) {
    if (!row.targetId || result.has(row.targetId)) continue
    if (!["failed", "expired", "cancelled"].includes(row.status)) {
      result.set(row.targetId, { id: row.id, status: row.status })
    }
  }
  // Second pass — for orders without a live session, surface the latest paid
  // (or any terminal) one so the badge can still report status.
  for (const row of rows) {
    if (!row.targetId || result.has(row.targetId)) continue
    result.set(row.targetId, { id: row.id, status: row.status })
  }
  return result
}

function attachPaymentSession<T extends FlightOrder>(
  order: T,
  summary: PaymentSessionSummary | null,
): T {
  if (!summary) return order
  return {
    ...order,
    providerData: {
      ...(order.providerData ?? {}),
      paymentSessionId: summary.sessionId,
      paymentStatus: summary.status,
    },
  }
}

/**
 * Build a single-line human summary of the flight order — surfaced as
 * `payment_session.notes` so the public landing page can show the customer
 * what they're paying for. Format keeps it terse: route + date for each
 * itinerary, joined by " · " for round trips, then passenger names.
 *
 * Example: "LHR → JFK · Sat 16 May  ·  JFK → LHR · Sat 23 May  ·  Diego Müller"
 */
function buildFlightSummary(order: FlightOrder): string {
  const parts: string[] = []
  for (const itin of order.offer.itineraries) {
    if (itin.segments.length === 0) continue
    const first = itin.segments[0]
    const last = itin.segments[itin.segments.length - 1]
    if (!first || !last) continue
    parts.push(
      `${first.departure.iataCode} → ${last.arrival.iataCode} · ${formatDay(first.departure.at)}`,
    )
  }
  const paxNames = order.passengers
    .map((p) => `${p.firstName} ${p.lastName}`.trim())
    .filter(Boolean)
  if (paxNames.length > 0) parts.push(paxNames.join(", "))
  return parts.join("  ·  ")
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function createFlightAdminRoutes(): Hono {
  const hono = new Hono()
  // ── Search ────────────────────────────────────────────────────────────
  hono.post("/search", async (c) => {
    let body: FlightSearchRequest
    try {
      body = await c.req.json<FlightSearchRequest>()
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    if (!body.slices?.length) return c.json({ error: "slices is required" }, 400)
    if (!body.passengers?.adults || body.passengers.adults < 1) {
      return c.json({ error: "passengers.adults must be at least 1" }, 400)
    }

    try {
      const response = await getAdapter(c).searchFlights(buildContext(c), body)
      return c.json(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // ── Ancillaries ───────────────────────────────────────────────────────
  hono.post("/ancillaries", async (c) => {
    let body: AncillaryRequest
    try {
      body = await c.req.json<AncillaryRequest>()
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    if (!body.offerId) return c.json({ error: "offerId is required" }, 400)
    const ancillariesAdapter = getAdapter(c)
    if (!ancillariesAdapter.getAncillaries) {
      return c.json({ error: "Connector does not declare flight/ancillaries capability" }, 501)
    }
    try {
      const response = await ancillariesAdapter.getAncillaries(buildContext(c), body)
      return c.json(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // ── Seat map ──────────────────────────────────────────────────────────
  hono.post("/seatmap", async (c) => {
    let body: SeatMapRequest
    try {
      body = await c.req.json<SeatMapRequest>()
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    if (!body.offerId) return c.json({ error: "offerId is required" }, 400)
    if (!body.segmentId) return c.json({ error: "segmentId is required" }, 400)
    const seatMapAdapter = getAdapter(c)
    if (!seatMapAdapter.getSeatMap) {
      return c.json({ error: "Connector does not declare flight/seatmap capability" }, 501)
    }
    try {
      const response = await seatMapAdapter.getSeatMap(buildContext(c), body)
      return c.json(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const isNotFound = /not found/i.test(message)
      return c.json({ error: message }, isNotFound ? 404 : 500)
    }
  })

  // ── Re-price ──────────────────────────────────────────────────────────
  hono.post("/price", async (c) => {
    let body: FlightPriceRequest
    try {
      body = await c.req.json<FlightPriceRequest>()
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    if (!body.offerId) return c.json({ error: "offerId is required" }, 400)

    try {
      const response = await getAdapter(c).priceOffer(buildContext(c), body)
      return c.json(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // ── Book ──────────────────────────────────────────────────────────────
  hono.post("/book", async (c) => {
    let body: FlightBookRequest
    try {
      body = await c.req.json<FlightBookRequest>()
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    if (!body.offerId) return c.json({ error: "offerId is required" }, 400)
    if (!body.passengers?.length) return c.json({ error: "passengers is required" }, 400)

    try {
      const response = await getAdapter(c).bookFlight(buildContext(c), body)
      // Hold is the default intent; if the operator picked it (or didn't
      // override), eagerly create the payment session + start netopia so
      // the order page can show the shareable link immediately.
      const isHold = !body.paymentIntent || body.paymentIntent.type === "hold"
      if (isHold && response.order) {
        const summary = await ensureFlightOrderPaymentSession(c, response.order, body.contact)
        response.order = attachPaymentSession(response.order, summary)
      }
      return c.json(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // ── List orders ───────────────────────────────────────────────────────
  hono.get("/orders", async (c) => {
    const listAdapter = getAdapter(c)
    if (!listAdapter.listOrders) {
      return c.json({ error: "Adapter does not support listing orders" }, 501)
    }
    const url = new URL(c.req.url)
    const limitParam = url.searchParams.get("limit")
    const cursor = url.searchParams.get("cursor") ?? undefined
    const search = url.searchParams.get("q") ?? url.searchParams.get("search") ?? undefined
    const statusParam = url.searchParams.getAll("status")
    const status = statusParam.length > 0 ? (statusParam as FlightOrderStatus[]) : undefined
    const limit = limitParam
      ? Math.max(1, Math.min(100, Number.parseInt(limitParam, 10)))
      : undefined
    // Operator-side filter applied after enrichment — the flight adapter
    // doesn't know about payment_sessions (those live in finance).
    const paymentStatusParam = url.searchParams.getAll("paymentStatus")
    const paymentStatusFilter = paymentStatusParam.length > 0 ? new Set(paymentStatusParam) : null
    try {
      const response = await listAdapter.listOrders(buildContext(c), {
        ...(limit !== undefined ? { limit } : {}),
        ...(cursor !== undefined ? { cursor } : {}),
        ...(search !== undefined ? { search } : {}),
        ...(status !== undefined ? { status } : {}),
      })

      // Bulk-fetch payment sessions for every order in this page so we can
      // attach `paymentStatus` without an N+1.
      const orderIds = response.orders.map((o) => o.orderId)
      const sessionByOrderId = await fetchPaymentSessionsByOrderIds(c, orderIds)
      response.orders = response.orders.map((order) => {
        const sess = sessionByOrderId.get(order.orderId)
        return attachPaymentSession(
          order,
          sess ? { sessionId: sess.id, status: sess.status } : null,
        )
      })

      if (paymentStatusFilter) {
        response.orders = response.orders.filter((o) => {
          const status = (o.providerData?.paymentStatus as string | undefined) ?? "none"
          return paymentStatusFilter.has(status)
        })
      }

      return c.json(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // ── Get order ─────────────────────────────────────────────────────────
  hono.get("/orders/:orderId", async (c) => {
    const orderId = c.req.param("orderId")
    if (!orderId) return c.json({ error: "orderId is required" }, 400)
    try {
      const response = await getAdapter(c).getOrder(buildContext(c), orderId)
      // Re-attach the payment session id on every read — the flight adapter
      // doesn't persist `providerData` mutations between calls, but the
      // session itself lives in finance and is found by clientReference.
      if (response.order) {
        const summary = await ensureFlightOrderPaymentSession(
          c,
          response.order,
          response.order.contact,
        )
        response.order = attachPaymentSession(response.order, summary)
      }
      return c.json(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const isNotFound = /not found/i.test(message)
      return c.json({ error: message }, isNotFound ? 404 : 500)
    }
  })

  // ── Cancel order ──────────────────────────────────────────────────────
  hono.post("/orders/:orderId/cancel", async (c) => {
    const orderId = c.req.param("orderId")
    if (!orderId) return c.json({ error: "orderId is required" }, 400)
    let body: { reason?: FlightCancelReason } = {}
    try {
      body = await c.req.json<{ reason?: FlightCancelReason }>()
    } catch {
      // Body is optional for cancel.
    }
    try {
      const response = await getAdapter(c).cancelOrder(buildContext(c), orderId, body.reason)
      return c.json(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const isNotFound = /not found/i.test(message)
      return c.json({ error: message }, isNotFound ? 404 : 500)
    }
  })

  // ── Reference: airports (with substring search) ───────────────────────
  hono.get("/reference/airports", async (c) => {
    const db = getDb(c)
    const q = c.req.query("q")?.trim()
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200)

    let rows: Array<typeof referenceAirports.$inferSelect>
    if (q) {
      const pattern = `%${q}%`
      rows = await db
        .select()
        .from(referenceAirports)
        .where(
          or(
            ilike(referenceAirports.iataCode, pattern),
            ilike(referenceAirports.city, pattern),
            ilike(referenceAirports.name, pattern),
          ),
        )
        .limit(limit)
    } else {
      rows = await db.select().from(referenceAirports).limit(limit)
    }

    return c.json({ data: rows })
  })

  // ── Reference: airlines (full list) ───────────────────────────────────
  hono.get("/reference/airlines", async (c) => {
    const db = getDb(c)
    const rows = await db.select().from(referenceAirlines)
    return c.json({ data: rows })
  })

  // ── Reference: aircraft (full list) ───────────────────────────────────
  hono.get("/reference/aircraft", async (c) => {
    const db = getDb(c)
    const rows = await db.select().from(referenceAircraft)
    return c.json({ data: rows })
  })

  return hono
}
