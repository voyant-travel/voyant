/**
 * Flight-specific payment integration: maps a `FlightOrder` onto finance's
 * generic order-payment-session service and, for card-capable flows,
 * optionally starts a card provider.
 *
 * The flights module stays payment-provider agnostic AND finance-agnostic — the
 * deps below are typed STRUCTURALLY so this file imports neither
 * `@voyant-travel/finance` nor any payment provider. The deployment wires the
 * concrete services in `createFlightOrderPaymentIntegration({ ... })`.
 *
 * What's flight-specific (and therefore lives here, not in finance):
 *   - mapping `order.totalPrice` → amountCents/currency,
 *   - picking the payer from `order.passengers[0]`,
 *   - the `notes` summary (`buildFlightSummary`),
 *   - synthesizing card billing (`synthesizeBilling`).
 */
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { Context } from "hono"
import type { FlightOrderPaymentSummary, FlightPaymentIntegration } from "./api-runtime.js"
import type { FlightOrder, FlightPassenger } from "./contract/types.js"

// `c.var.db` is set by the createApp DB middleware; the global ContextVariableMap
// doesn't declare it, so cast at the call site to keep type-safety local.
function getDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
}

export function parseAmountToCents(amount: string): number {
  const n = Number.parseFloat(amount)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/** Card billing details synthesized from a passenger + (optional) contact. */
export interface FlightCardBilling {
  email: string
  phone: string
  firstName: string
  lastName: string
  city: string
  country: number
  state: string
  postalCode: string
  details: string
}

export function synthesizeBilling(
  pax: FlightPassenger,
  contact: { email?: string; phone?: string } | undefined,
): FlightCardBilling {
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

export function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
}

/**
 * Build a single-line human summary of the flight order — surfaced as
 * `payment_session.notes` so the public landing page can show what's being paid.
 */
export function buildFlightSummary(order: FlightOrder): string {
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

/**
 * Structural shape of finance's generic order-payment-session service. Matches
 * `@voyant-travel/finance`'s `createOrderPaymentSessions(...)` return value —
 * declared here (not imported) so flights never depends on finance.
 */
export interface OrderPaymentSessionsLike {
  ensureSession(
    db: AnyDrizzleDb,
    params: {
      targetId: string
      currency: string
      amountCents: number
      payerEmail?: string | null
      payerName?: string | null
      notes?: string | null
      paymentMethod?: "bank_transfer" | "credit_card" | null
    },
    startProvider?: (db: AnyDrizzleDb, sessionId: string) => Promise<void>,
  ): Promise<{ sessionId: string; status: string } | null>
  fetchSessions(
    db: AnyDrizzleDb,
    targetIds: string[],
  ): Promise<Map<string, { sessionId: string; status: string }>>
}

export interface FlightOrderPaymentSessionOptions {
  paymentMethod?: "bank_transfer" | "credit_card"
  startCardPayment?: boolean
}

export interface FlightOrderPaymentIntegrationDeps {
  /** Finance's generic order-payment-session service (structural). */
  orderPaymentSessions: OrderPaymentSessionsLike
  /**
   * Optional card provider start. Best-effort — called after a session is
   * created so the provider can populate the card redirect link. The deployment
   * supplies its card provider (e.g. Netopia); flights stays provider-agnostic.
   *
   * Receives the request `Context` (so the deployment can resolve its
   * request-scoped provider runtime / container) plus the new session id and
   * synthesized card billing.
   */
  startCardPayment?(c: Context, sessionId: string, billing: FlightCardBilling): Promise<void>
}

/**
 * Build a {@link FlightPaymentIntegration} from the generic order-payment
 * service + an optional card provider. The deployment composes this in its
 * flights runtime wiring.
 */
export function createFlightOrderPaymentIntegration(
  deps: FlightOrderPaymentIntegrationDeps,
): FlightPaymentIntegration {
  const { orderPaymentSessions, startCardPayment } = deps

  return {
    async ensureOrderSession(c, order, contact, options?: FlightOrderPaymentSessionOptions) {
      const db = getDb(c)
      const passengerForBilling = order.passengers[0]
      if (!passengerForBilling) return null

      const amountCents = parseAmountToCents(order.totalPrice.amount)

      const shouldStartCardPayment = options?.startCardPayment ?? true
      const startProvider =
        startCardPayment && shouldStartCardPayment
          ? (_writer: AnyDrizzleDb, sessionId: string) =>
              startCardPayment(c, sessionId, synthesizeBilling(passengerForBilling, contact))
          : undefined

      return orderPaymentSessions.ensureSession(
        db,
        {
          targetId: order.orderId,
          currency: order.totalPrice.currency,
          amountCents,
          payerEmail: contact?.email ?? passengerForBilling.email ?? null,
          payerName: `${passengerForBilling.firstName} ${passengerForBilling.lastName}`.trim(),
          notes: buildFlightSummary(order),
          paymentMethod: options?.paymentMethod,
        },
        startProvider,
      )
    },

    async fetchOrderSessions(c, orderIds) {
      const result = new Map<string, FlightOrderPaymentSummary>()
      if (orderIds.length === 0) return result
      return orderPaymentSessions.fetchSessions(getDb(c), orderIds)
    },
  }
}
