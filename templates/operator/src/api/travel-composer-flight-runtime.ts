import type {
  AncillarySelection,
  FlightBookRequest,
  FlightOffer,
  FlightPassenger,
  PassengerType,
} from "@voyantjs/flights/contract/types"
import { createDemoFlightAdapter } from "@voyantjs/plugin-flights-demo"
import type {
  ReserveComponentInput,
  ReserveComponentPreflightResult,
  ReserveComponentResult,
} from "@voyantjs/travel-composer"
import type { Context } from "hono"
import {
  formatTripBillingName,
  readTripBilling,
  splitTripBillingName,
} from "./travel-composer-trip-checkout"

export async function validateNonCatalogComponentBeforeReserve(
  c: Context,
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
    const priced = await getFlightAdapter(c).priceOffer(buildFlightAdapterContext(c), {
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
      input.component.componentCurrency ?? stringValue(previousPricing?.currency) ?? currentCurrency

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

export async function reserveNonCatalogComponent(
  c: Context,
  input: ReserveComponentInput,
): Promise<ReserveComponentResult | null> {
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
  const response = await getFlightAdapter(c).bookFlight(buildFlightAdapterContext(c), request)
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

function getFlightAdapter(c: Context) {
  const baseUrl = (c.env as { FLIGHTS_DEMO_API_URL?: string }).FLIGHTS_DEMO_API_URL
  if (!baseUrl) {
    throw new Error(
      "FLIGHTS_DEMO_API_URL is not set. Start `apps/flights-demo-api` and point this env at it.",
    )
  }
  return createDemoFlightAdapter({ baseUrl })
}

function buildFlightAdapterContext(c: Context): { connectionId: string; correlationId?: string } {
  return {
    connectionId: "demo",
    correlationId: c.req.header("x-request-id") ?? undefined,
  }
}

function moneyToCents(amount: string): number {
  const parsed = Number.parseFloat(amount)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
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
