/**
 * Operator (deployment) wiring for the flights module.
 *
 * The flight admin routes live in `@voyant-travel/flights`. This file supplies
 * the deployment-specific options the module needs:
 *   - which connector adapter to use (the demo connector for now),
 *   - how hold orders get a payment link (this deployment uses finance +
 *     Netopia).
 *
 * Swapping to a real GDS connector, or a different payment provider, is a change
 * here — never in the route implementations.
 */
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { financeService } from "@voyant-travel/finance"
import { paymentSessions } from "@voyant-travel/finance/schema"
import {
  createFlightAdminRoutes,
  type FlightOrder,
  type FlightOrderPaymentSummary,
  type FlightPassenger,
  type FlightPaymentIntegration,
} from "@voyant-travel/flights"
import { createDemoFlightAdapter } from "@voyant-travel/plugin-flights-demo"
import {
  NETOPIA_RUNTIME_CONTAINER_KEY,
  netopiaService,
  type ResolvedNetopiaRuntimeOptions,
} from "@voyant-travel/plugin-netopia"
import { and, desc, eq, inArray } from "drizzle-orm"
import type { Context } from "hono"

/**
 * Resolve the flight connector adapter. The demo adapter is a thin HTTP client
 * to `apps/flights-demo-api` (set `FLIGHTS_DEMO_API_URL`). Swapping to a real
 * GDS connector is a one-line change here.
 */
function resolveAdapter(c: Context) {
  const baseUrl = (c.env as { FLIGHTS_DEMO_API_URL?: string }).FLIGHTS_DEMO_API_URL
  if (!baseUrl) {
    throw new Error(
      "FLIGHTS_DEMO_API_URL is not set. Start `apps/flights-demo-api` and point this env at it (e.g. http://localhost:3320).",
    )
  }
  return createDemoFlightAdapter({ baseUrl })
}

function getDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
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

function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
}

/**
 * Build a single-line human summary of the flight order — surfaced as
 * `payment_session.notes` so the public landing page can show what's being paid.
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

const payment: FlightPaymentIntegration = {
  async ensureOrderSession(c, order, contact) {
    const db = getDb(c) as Parameters<typeof financeService.createPaymentSession>[0]
    const passengerForBilling = order.passengers[0]
    if (!passengerForBilling) return null

    // Prefer the most recent non-terminal session for this order so the UI
    // surfaces a live link; fall back to paid/authorized history.
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
    const latest = existing[0]
    if (latest && ["paid", "authorized"].includes(latest.status)) {
      return { sessionId: latest.id, status: latest.status }
    }

    const amountCents = parseAmountToCents(order.totalPrice.amount)
    if (amountCents <= 0) return null

    const session = await financeService.createPaymentSession(db, {
      targetType: "flight_order",
      targetId: order.orderId,
      currency: order.totalPrice.currency,
      amountCents,
      status: "pending",
      provider: "netopia",
      paymentMethod: "credit_card",
      payerEmail: contact?.email ?? passengerForBilling.email ?? null,
      payerName: `${passengerForBilling.firstName} ${passengerForBilling.lastName}`.trim(),
      notes: buildFlightSummary(order),
    })

    // Start Netopia so `redirectUrl` is populated for the landing page's card
    // tab. Best-effort — the bank-transfer tab still works if it fails.
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
      console.warn("[flights] netopia start failed for hold session:", err)
    }

    return { sessionId: session.id, status: session.status }
  },

  async fetchOrderSessions(c, orderIds) {
    const result = new Map<string, FlightOrderPaymentSummary>()
    if (orderIds.length === 0) return result
    const rows = await getDb(c)
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

    // First pass — most recent non-terminal session per order.
    for (const row of rows) {
      if (!row.targetId || result.has(row.targetId)) continue
      if (!["failed", "expired", "cancelled"].includes(row.status)) {
        result.set(row.targetId, { sessionId: row.id, status: row.status })
      }
    }
    // Second pass — fall back to the latest (terminal) session for status.
    for (const row of rows) {
      if (!row.targetId || result.has(row.targetId)) continue
      result.set(row.targetId, { sessionId: row.id, status: row.status })
    }
    return result
  },
}

/** Build the flights admin routes wired with this deployment's options. */
export function buildFlightAdminRoutes() {
  return createFlightAdminRoutes({ resolveAdapter, payment })
}
