/**
 * Non-catalog (flight) trip-component orchestration — owned by
 * `@voyant-travel/trips`.
 *
 * Trips owns the reserve/checkout flow for flight placeholder components, so the
 * orchestration that prices a selected flight offer before reserve (detecting
 * price changes / expiry) and books the held flight order lives here:
 *   - flight preflight + price-change detection (`validateBeforeReserve`),
 *   - passenger-roster building (DOB / contact fallbacks) + billing mapping,
 *   - reserve (book the held flight order),
 *   - cancellation mapping to the flight connector order.
 *
 * WHY THE FLIGHT ADAPTER IS INJECTED (not imported):
 *
 * Trips reads flight *contract types* from `@voyant-travel/flights` (a leaf
 * contract dependency, acyclic), but the concrete adapter is deployment-specific
 * provider wiring, so it is injected via `options.adapter` rather than imported. The price/expiry
 * detection, passenger mapping, and billing fallbacks are vertical-agnostic
 * orchestration and live here.
 *
 * Behaviour is byte-for-byte equivalent to the operator's previous
 * `trips-flight-runtime.ts`.
 */
import type {
  FlightCancelReason,
  FlightCancelResponse,
} from "@voyant-travel/flights/contract/adapter"
import type {
  AncillarySelection,
  FlightBookRequest,
  FlightOffer,
  FlightOrder,
  FlightPassenger,
  PassengerType,
} from "@voyant-travel/flights/contract/types"

import { formatTripBillingName, readTripBilling, splitTripBillingName } from "./checkout/index.js"
import type {
  CancelComponentInput,
  CancelComponentResult,
  ComponentCancellationPreview,
  ComponentCancellationPreviewInput,
  ReserveComponentInput,
  ReserveComponentPreflightResult,
  ReserveComponentResult,
} from "./service-types.js"

/** Per-request adapter context propagated to the flight adapter. */
export interface FlightAdapterContext {
  connectionId: string
  correlationId?: string
}

/**
 * The minimal flight-adapter surface the orchestration needs. Injected because
 * the concrete adapter is deployment-specific provider wiring.
 */
export interface FlightComponentAdapter {
  priceOffer(
    ctx: FlightAdapterContext,
    request: { offerId: string; offer?: FlightOffer },
  ): Promise<{ offer: FlightOffer; valid: boolean; invalidReason?: string }>
  bookFlight(ctx: FlightAdapterContext, request: FlightBookRequest): Promise<{ order: FlightOrder }>
  cancelOrder(
    ctx: FlightAdapterContext,
    orderId: string,
    reason?: FlightCancelReason,
  ): Promise<FlightCancelResponse>
}

/** Deployment-supplied, request-scoped flight wiring. */
export interface FlightComponentAdapterOptions {
  /** The deployment-specific flight adapter (provider + base URL). */
  adapter: FlightComponentAdapter
  /** Per-request adapter context (connection id + correlation id). */
  adapterContext: FlightAdapterContext
}

/** The flight component orchestration surface produced by the factory. */
export interface FlightComponentAdapterApi {
  validateBeforeReserve(
    input: ReserveComponentInput,
  ): Promise<ReserveComponentPreflightResult | null>
  reserve(input: ReserveComponentInput): Promise<ReserveComponentResult | null>
  previewCancellation(
    input: ComponentCancellationPreviewInput,
  ): Promise<ComponentCancellationPreview>
  cancel(input: CancelComponentInput): Promise<CancelComponentResult>
}

/**
 * Build the flight (non-catalog) trip-component orchestration bound to a
 * request's flight adapter + adapter context.
 */
export function createFlightComponentAdapter(
  options: FlightComponentAdapterOptions,
): FlightComponentAdapterApi {
  const { adapter, adapterContext } = options

  async function validateBeforeReserve(
    input: ReserveComponentInput,
  ): Promise<ReserveComponentPreflightResult | null> {
    if (input.component.kind !== "flight_placeholder") return null

    const flightDraft = asRecord(input.component.metadata)?.flightDraft
    const draftRecord = asRecord(flightDraft)
    const selectedOffer = draftRecord?.selectedOffer as FlightOffer | undefined
    const offerId = stringValue(draftRecord?.offerId) ?? selectedOffer?.offerId
    if (!selectedOffer || !offerId) {
      return { status: "unavailable", reason: "flight_offer_required" }
    }

    try {
      const priced = await adapter.priceOffer(adapterContext, {
        offerId,
        offer: selectedOffer,
      })
      if (!priced.valid) {
        return {
          status: "unavailable",
          reason: priced.invalidReason ?? "flight_offer_unavailable",
          details: { offerId },
        }
      }

      const previousPricing = asRecord(draftRecord?.pricing)
      const ancillaryAmountCents = numberValue(previousPricing?.ancillaryAmountCents) ?? 0
      const currentTotalAmountCents =
        moneyToCents(priced.offer.totalPrice.amount) + ancillaryAmountCents
      const previousTotalAmountCents =
        input.component.componentTotalAmountCents ??
        numberValue(previousPricing?.totalAmountCents) ??
        0
      const currentCurrency = priced.offer.totalPrice.currency
      const previousCurrency =
        input.component.componentCurrency ??
        stringValue(previousPricing?.currency) ??
        currentCurrency

      if (
        currentCurrency !== previousCurrency ||
        currentTotalAmountCents !== previousTotalAmountCents
      ) {
        return {
          status: "price_changed",
          reason: "flight_price_changed",
          details: {
            offerId,
            previous: {
              currency: previousCurrency,
              totalAmountCents: previousTotalAmountCents,
            },
            current: {
              currency: currentCurrency,
              totalAmountCents: currentTotalAmountCents,
            },
          },
        }
      }

      return { status: "ok" }
    } catch (error) {
      return {
        status: isExpiredOffer(selectedOffer) ? "expired" : "unavailable",
        reason: error instanceof Error ? error.message : "flight_offer_unavailable",
        details: { offerId },
      }
    }
  }

  async function reserve(input: ReserveComponentInput): Promise<ReserveComponentResult | null> {
    if (input.component.kind !== "flight_placeholder") return null

    const flightDraft = asRecord(input.component.metadata)?.flightDraft
    const selectedOffer = asRecord(flightDraft)?.selectedOffer as FlightOffer | undefined
    if (!selectedOffer?.offerId) {
      throw new Error("flight_offer_required")
    }

    const request: FlightBookRequest = {
      offerId: selectedOffer.offerId,
      offer: selectedOffer,
      passengers: flightPassengersFromTravelerParty(input.envelope.travelerParty),
      contact: flightContactFromTravelerParty(input.envelope.travelerParty),
      paymentIntent: { type: "hold" },
      ancillaries: asRecord(flightDraft)?.ancillaries as AncillarySelection | undefined,
    }
    const response = await adapter.bookFlight(adapterContext, request)
    const order = response.order

    return {
      status: order.status === "ticketed" ? "booked" : "held",
      orderId: order.orderId,
      providerRef: order.pnr ?? order.orderId,
      supplierRef: order.orderId,
      holdExpiresAt: order.paymentDeadline,
      warnings: order.paymentDeadline ? undefined : ["flight_hold_deadline_missing"],
    }
  }

  async function previewCancellation(
    input: ComponentCancellationPreviewInput,
  ): Promise<ComponentCancellationPreview> {
    return previewFlightCancellation(input)
  }

  async function cancel(input: CancelComponentInput): Promise<CancelComponentResult> {
    const component = input.component
    if (component.kind !== "flight_placeholder") {
      return { status: "refused", reason: "not_flight_component" }
    }
    if (!component.orderId) {
      return { status: "refused", reason: "missing_flight_order_ref" }
    }

    const response = await adapter.cancelOrder(
      adapterContext,
      component.orderId,
      toFlightCancelReason(input.reason),
    )
    const orderStatus = response.order.status
    if (orderStatus !== "cancelled") {
      return {
        status: "refused",
        reason: `flight_order_not_cancelled:${orderStatus}`,
        snapshot: flightCancelSnapshot(response, component),
      }
    }

    return {
      status: "cancelled",
      refundAmountCents: response.refundedAmount
        ? moneyToCents(response.refundedAmount.amount)
        : input.preview.refundAmountCents,
      refundCurrency: response.refundedAmount?.currency ?? input.preview.refundCurrency,
      snapshot: flightCancelSnapshot(response, component),
    }
  }

  return { validateBeforeReserve, reserve, previewCancellation, cancel }
}

export function previewFlightCancellation(
  input: ComponentCancellationPreviewInput,
): Promise<ComponentCancellationPreview> {
  const component = input.component
  if (component.kind !== "flight_placeholder") {
    return Promise.resolve({
      componentId: component.id,
      action: "staff_remediation",
      currentStatus: component.status,
      staffActionRequired: true,
      reason: "not_flight_component",
    })
  }

  if (!component.orderId) {
    return Promise.resolve({
      componentId: component.id,
      action: "staff_remediation",
      currentStatus: component.status,
      staffActionRequired: true,
      reason: "missing_flight_order_ref",
    })
  }

  return Promise.resolve({
    componentId: component.id,
    action: "cancel",
    currentStatus: component.status,
    staffActionRequired: false,
    refundAmountCents: 0,
    refundCurrency: component.componentCurrency ?? undefined,
    penaltyAmountCents: 0,
    policySummary:
      "Flight supplier cancellation preview is not available; cancellation result is authoritative.",
    snapshot: {
      orderId: component.orderId,
      providerRef: component.providerRef,
      supplierRef: component.supplierRef,
    },
  })
}

// ── Pure helpers (vertical-agnostic) ────────────────────────────────────────

function moneyToCents(amount: string): number {
  const parsed = Number.parseFloat(amount)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function toFlightCancelReason(reason: string | undefined): FlightCancelReason | undefined {
  if (isFlightCancelReason(reason)) return reason
  return reason ? "customer_request" : undefined
}

function isFlightCancelReason(reason: string | undefined): reason is FlightCancelReason {
  return (
    reason === "customer_request" ||
    reason === "schedule_change" ||
    reason === "operational" ||
    reason === "fraud"
  )
}

function flightCancelSnapshot(
  response: FlightCancelResponse,
  component: { orderId: string | null; providerRef: string | null; supplierRef: string | null },
): Record<string, unknown> {
  return {
    orderId: response.order.orderId,
    orderStatus: response.order.status,
    providerRef: component.providerRef,
    supplierRef: component.supplierRef,
    refundedAmount: response.refundedAmount ?? null,
  }
}

function isExpiredOffer(offer: FlightOffer): boolean {
  const expiresAt = offer.expiresAt ? new Date(offer.expiresAt) : null
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now())
}

function flightPassengersFromTravelerParty(travelerParty: Record<string, unknown>) {
  const travelers = Array.isArray(travelerParty.travelers)
    ? (travelerParty.travelers as unknown[])
    : []
  const passengers = travelers.map((traveler, index) =>
    flightPassengerFromTraveler(asRecord(traveler) ?? {}, index),
  )
  if (passengers.length > 0) return passengers

  const billing = readTripBilling(travelerParty)
  const names = splitTripBillingName(formatTripBillingName(billing) ?? "Lead traveler")
  return [
    {
      passengerId: "traveler_1",
      type: "adult" as const,
      firstName: names.firstName,
      lastName: names.lastName,
      dateOfBirth: "1990-01-01",
      ...(billing.contact?.email ? { email: billing.contact.email } : {}),
      ...(billing.contact?.phone ? { phone: billing.contact.phone } : {}),
    },
  ]
}

function flightPassengerFromTraveler(
  traveler: Record<string, unknown>,
  index: number,
): FlightPassenger {
  const type = passengerTypeFromRole(stringValue(traveler.role))
  return {
    passengerId:
      stringValue(traveler.localId) || stringValue(traveler.personId) || `traveler_${index + 1}`,
    type,
    firstName: stringValue(traveler.firstName) || fallbackFirstName(type),
    lastName: stringValue(traveler.lastName) || `${index + 1}`,
    dateOfBirth: stringValue(traveler.dateOfBirth) || fallbackDobForPassengerType(type),
    ...(stringValue(traveler.email) ? { email: stringValue(traveler.email) ?? undefined } : {}),
    ...(stringValue(traveler.phone) ? { phone: stringValue(traveler.phone) ?? undefined } : {}),
  }
}

function passengerTypeFromRole(role: string | null): PassengerType {
  if (role === "child") return "child"
  if (role === "infant") return "infant"
  return "adult"
}

function fallbackFirstName(type: PassengerType): string {
  if (type === "child") return "Child"
  if (type === "infant") return "Infant"
  return "Adult"
}

function fallbackDobForPassengerType(type: PassengerType): string {
  if (type === "child") return "2016-01-01"
  if (type === "infant") return "2025-01-01"
  return "1990-01-01"
}

function flightContactFromTravelerParty(travelerParty: Record<string, unknown>) {
  const billing = readTripBilling(travelerParty)
  return {
    ...(billing.contact?.email ? { email: billing.contact.email } : {}),
    ...(billing.contact?.phone ? { phone: billing.contact.phone } : {}),
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
