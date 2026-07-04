import type {
  AncillarySelection,
  FlightBookRequest,
  FlightOffer,
  FlightOrder,
  FlightTicket,
} from "@voyant-travel/flights/contract/types"

import { catalogForItinerary } from "./synthesis-ancillaries.js"
import { hashString, mulberry32 } from "./synthesis-common.js"
import { findSeatInMap, synthesizeSeatMap } from "./synthesis-seat-maps.js"

/**
 * Build a deterministic-ish FlightOrder from a book request. PNR + orderId
 * are derived from the offerId hash so the same offer always produces the
 * same record locator (handy for testing). Status defaults to `confirmed`
 * with a 24h payment deadline; `card`/`ticket_on_credit` intents flip
 * straight to `ticketed` and emit fake ticket numbers. Ancillary selections
 * are summed into the order total and echoed on `providerData.ancillaries`.
 */
export function synthesizeOrder(request: FlightBookRequest): FlightOrder {
  const offer = request.offer!
  // Seed with the offer + the wall clock + a random nonce so every
  // `bookFlight` call produces a fresh PNR and orderId — real GDS systems
  // never reuse PNRs even for identical itineraries. Determinism is only
  // useful for offers/seatmaps (stable deep-links during dev), not orders.
  const seed = hashString(`${offer.offerId}|${Date.now()}|${Math.random()}`)
  const rand = mulberry32(seed)
  const pnr = randomPnr(rand)
  const orderId = `demo_ord_${pnr.toLowerCase()}`
  const intent = request.paymentIntent ?? { type: "hold" }
  const ticketed = intent.type !== "hold"

  const tickets: FlightTicket[] | undefined = ticketed
    ? request.passengers.map((p) => ({
        ticketNumber: `${offer.validatingCarrier ?? "XX"}${String(100_000_000 + Math.floor(rand() * 900_000_000))}`,
        passengerId: p.passengerId,
        segmentIds: offer.itineraries.flatMap((i) => i.segments.map((s) => s.segmentId)),
        status: "OK",
      }))
    : undefined

  const now = new Date()
  const paymentDeadline = ticketed
    ? undefined
    : new Date(now.getTime() + 24 * 60 * 60_000).toISOString()

  // Sum ancillary picks into the order total; the per-leg catalog the UI
  // fetched is what the prices reflect, but at this seam we re-synthesize
  // the catalog from each itinerary to look the prices up — keeps the
  // server authoritative on amounts (the UI's price could be stale).
  const ancillaryTotal = computeAncillaryTotal(offer, request.ancillaries)
  const orderTotal: FlightOrder["totalPrice"] = {
    amount: (Number(offer.totalPrice.amount) + ancillaryTotal).toFixed(2),
    currency: offer.totalPrice.currency,
  }

  const providerData: Record<string, unknown> = { ...(offer.providerData ?? {}) }
  if (request.ancillaries) providerData.ancillaries = request.ancillaries

  return {
    orderId,
    pnr,
    status: ticketed ? "ticketed" : "confirmed",
    offer,
    passengers: request.passengers,
    contact: request.contact,
    tickets,
    totalPrice: orderTotal,
    paymentDeadline,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    providerData,
  }
}

/**
 * Promote a held (`confirmed`) order to `ticketed`: emit fake ticket numbers
 * per passenger, drop the payment deadline, and stamp `updatedAt`. Mirrors the
 * ticket path of {@link synthesizeOrder} so the demo connector honors the
 * `flight/holds` capability it declares.
 */
export function ticketHeldOrder(order: FlightOrder): FlightOrder {
  const rand = mulberry32(hashString(`${order.orderId}|ticket`))
  const segmentIds = order.offer.itineraries.flatMap((i) => i.segments.map((s) => s.segmentId))
  const carrier = order.offer.validatingCarrier ?? "XX"
  const tickets: FlightTicket[] = order.passengers.map((p) => ({
    ticketNumber: `${carrier}${String(100_000_000 + Math.floor(rand() * 900_000_000))}`,
    passengerId: p.passengerId,
    segmentIds,
    status: "OK",
  }))
  return {
    ...order,
    status: "ticketed",
    tickets,
    paymentDeadline: undefined,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Compute the additional charge from ancillary picks against an offer. Looks
 * the prices up in the synthesized catalog (deterministic) so the server is
 * authoritative on totals — UI prices can be stale or tampered with.
 */
function computeAncillaryTotal(
  offer: FlightOffer,
  selection: AncillarySelection | undefined,
): number {
  if (!selection) return 0
  let total = 0

  // Branded-fare bundle picks — `priceDelta` is per-pax; each pick sums in
  // once. Per-pax per-slice picks naturally cover the "everyone same fare"
  // case (N picks of the same bundle id on a leg = N × delta).
  if (selection.fareBundle && offer.fareBundles && offer.fareBundles.length > 0) {
    for (const pick of selection.fareBundle) {
      const bundle = offer.fareBundles.find((b) => b.id === pick.bundleId)
      if (bundle) total += Number(bundle.priceDelta.amount)
    }
  }

  for (let sliceIndex = 0; sliceIndex < offer.itineraries.length; sliceIndex++) {
    const itin = offer.itineraries[sliceIndex]
    if (!itin) continue
    const catalog = catalogForItinerary(itin)
    for (const pick of selection.baggage ?? []) {
      if (pick.sliceIndex !== sliceIndex) continue
      const opt = catalog.baggage.find((o) => o.id === pick.optionId)
      if (opt) total += Number(opt.price.amount) * (pick.quantity ?? 1)
    }
    for (const pick of selection.extras ?? []) {
      if (pick.sliceIndex !== sliceIndex) continue
      const opt = catalog.extras.find((o) => o.id === pick.optionId)
      if (!opt) continue
      const qty = pick.quantity ?? 1
      total += Number(opt.price.amount) * qty
    }
  }
  // Seats — look up the per-segment map and price each pick. Seats can
  // span multiple itineraries; iterate over every segment in the offer.
  for (const itin of offer.itineraries) {
    for (const segment of itin.segments) {
      const seatMap = synthesizeSeatMap(segment)
      for (const pick of selection.seats ?? []) {
        if (pick.segmentId !== segment.segmentId) continue
        const seat = findSeatInMap(seatMap, pick.seatNumber)
        if (seat?.price) total += Number(seat.price.amount)
      }
    }
  }
  // Assistance is free in the demo (Wizz-style); skip.
  return total
}

function randomPnr(rand: () => number): string {
  // 6-char alphanumeric uppercase, classic GDS shape.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(rand() * alphabet.length)]
  }
  return out
}
