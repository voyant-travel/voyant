/**
 * Booking-time snapshot capture for flight orders.
 *
 * Flights are a partial-adoption vertical: they participate in the catalog
 * plane's snapshot graph but skip overlay / index / drift / RAG. This
 * helper turns a `FlightOffer` + `FlightOrder` pair into a
 * `CaptureSnapshotInput` ready for `captureSnapshot` /
 * `captureSnapshotGraph`.
 *
 * Mirrors the per-vertical pattern (`buildProductSnapshotInput`,
 * `buildCruiseSnapshotInput`, etc.) but skips the resolved-view step
 * because flights have no overlay store.
 *
 * See `docs/architecture/catalog-flights-architecture.md` §5.1 for the
 * full snapshot scope (frozen offer + order + segments + fare breakdown +
 * pricing basis).
 */

import type { CaptureSnapshotInput, PricingBasis } from "@voyant-travel/catalog-contracts/snapshot"

import type { FlightOffer, FlightOrder } from "./contract/types.js"

export interface BuildFlightSnapshotInputOptions {
  /** The booked flight offer at booking time (frozen view). */
  offer: FlightOffer
  /** The flight order returned by the adapter (PNR, ticket numbers, status). */
  order: FlightOrder
  /** The source kind — typically `"voyant-connect"` or a direct adapter slug. */
  sourceKind: string
  /** Source provider sub-identifier — e.g. `"hisky"`, `"amadeus"`. */
  sourceProvider?: string
  /** The connection identifier the booking was placed against. */
  sourceConnectionId?: string
  /** Optional override for the entity id; defaults to the adapter's `orderId`. */
  entityId?: string
}

/**
 * Build a `CaptureSnapshotInput` from a flight offer + order. Use the
 * result with `captureSnapshot` (single-flight bookings) or
 * `captureSnapshotGraph` (composite bookings — flight inside a tour
 * package, etc.).
 *
 * The `frozen_payload` carries the full FlightOffer and FlightOrder,
 * structured as `{ offer, order }`, so refunds and post-book operations
 * eight months later can read exactly what the customer paid for.
 *
 * The `pricing_basis` structured columns are populated from the offer's
 * `totalPrice`. Taxes / fees / surcharges decomposition is left to the
 * adapter — `FlightOffer` exposes `fareBreakdowns[]` per passenger which
 * the caller can aggregate as needed and pass via `pricingBasis`.
 */
export function buildFlightSnapshotInput(
  options: BuildFlightSnapshotInputOptions,
): Omit<CaptureSnapshotInput, "bookingId"> {
  const { offer, order, sourceKind, sourceProvider, sourceConnectionId, entityId } = options

  const frozenPayload = {
    offer,
    order,
  }

  const pricingBasis: PricingBasis | undefined = (() => {
    const total = offer.totalPrice ?? order.totalPrice
    if (!total) return undefined
    const baseAmount = Number.parseFloat(total.amount)
    if (!Number.isFinite(baseAmount)) return undefined
    return {
      base_amount: baseAmount,
      taxes: 0, // adapter decomposes if it tracks taxes separately
      fees: 0,
      surcharges: 0,
      currency: total.currency,
      breakdown: { fareBreakdowns: offer.fareBreakdowns },
    }
  })()

  return {
    entityModule: "flights",
    entityId: entityId ?? order.orderId,
    sourceKind,
    sourceProvider,
    sourceConnectionId,
    sourceRef: order.pnr ?? order.orderId,
    frozenPayload,
    pricingBasis,
  }
}
