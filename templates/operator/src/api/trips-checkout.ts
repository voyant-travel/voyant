import type { AnyDrizzleDb } from "@voyantjs/db"
import { buildPaymentLinkUrl, financeService } from "@voyantjs/finance"
import {
  NETOPIA_RUNTIME_CONTAINER_KEY,
  netopiaService,
  type ResolvedNetopiaRuntimeOptions,
} from "@voyantjs/plugin-netopia"
import type { Trip, TripCheckoutInput, TripCheckoutResult } from "@voyantjs/trips"
import type { Context } from "hono"

import { resolveVoyantApiKey } from "../lib/voyant-cloud"

interface TripCheckoutAllocation {
  componentId: string
  kind: string
  bookingId: string | null
  orderId: string | null
  sourceCurrency: string
  sourceAmountCents: number
  targetCurrency: string
  targetAmountCents: number
  fx?: {
    rate: number
    provider: "voyant_data_fx"
    quotedAt: string
    validUntil?: string | null
  }
}

export async function startTripCheckout(
  c: Context,
  input: TripCheckoutInput,
): Promise<TripCheckoutResult> {
  const db = getDb(c) as Parameters<typeof financeService.createPaymentSession>[0]
  const pricing = await checkoutPricingForTrip(c, input.trip, input.request)
  if (pricing.totalAmountCents <= 0) {
    throw new Error("trip_checkout_total_required")
  }

  const billing = readTripBilling(input.trip.envelope.travelerParty)
  const payerName = formatTripBillingName(billing)
  const payerEmail = billing.contact?.email ?? null
  if (!payerName || !payerEmail) {
    throw new Error("trip_checkout_billing_required")
  }
  const paymentMethod = input.intent === "bank_transfer" ? "bank_transfer" : "credit_card"
  const session = await financeService.createPaymentSession(db, {
    targetType: "other",
    targetId: input.trip.envelope.id,
    idempotencyKey: `trip-checkout:${input.trip.envelope.id}:${pricing.currency}:${pricing.totalAmountCents}`,
    clientReference: input.trip.envelope.id,
    currency: pricing.currency,
    amountCents: pricing.totalAmountCents,
    status: "pending",
    provider: input.intent === "bank_transfer" ? null : "netopia",
    paymentMethod,
    payerPersonId: billing.personId ?? null,
    payerOrganizationId: billing.organizationId ?? null,
    payerEmail,
    payerName,
    notes: buildTripPaymentSummary(input.trip, pricing.currency, pricing.allocations),
    metadata: {
      tripEnvelopeId: input.trip.envelope.id,
      collectionCurrency: pricing.currency,
      componentAllocations: pricing.allocations,
      fxAllocations: pricing.allocations.filter((allocation) => allocation.fx),
    },
  })

  if (input.intent !== "bank_transfer") {
    try {
      const runtime = getContainer(c)?.resolve(NETOPIA_RUNTIME_CONTAINER_KEY) as
        | ResolvedNetopiaRuntimeOptions
        | undefined
      if (runtime) {
        await netopiaService.startPaymentSession(
          db,
          session.id,
          {
            billing: synthesizeTripBilling(billing),
            description: `Trip ${input.trip.envelope.id}`,
          },
          runtime,
          undefined,
        )
      }
    } catch (error) {
      console.warn("[trips] netopia start failed for trip payment session:", error)
    }
  }

  return {
    kind: input.intent === "bank_transfer" ? "bank_transfer_instructions" : "payment_session",
    paymentSessionId: session.id,
    checkoutUrl: buildPaymentLinkUrl(session.id, {
      baseUrl: resolvePublicCheckoutBaseUrl(c.env as CloudflareBindings),
    }),
  }
}

function resolvePublicCheckoutBaseUrl(env: CloudflareBindings): string | null {
  return (
    env.PUBLIC_CHECKOUT_BASE_URL?.trim() ||
    env.DASH_BASE_URL?.trim() ||
    env.APP_URL?.trim().replace(/\/api\/?$/, "") ||
    null
  )
}

async function checkoutPricingForTrip(
  c: Context,
  trip: Trip,
  request: Record<string, unknown>,
): Promise<{
  currency: string
  totalAmountCents: number
  allocations: TripCheckoutAllocation[]
}> {
  const active = trip.components.filter(
    (component) => component.status !== "removed" && component.status !== "cancelled",
  )
  const collectionCurrency =
    stringValue(request.collectionCurrency) ?? trip.envelope.aggregateCurrency ?? "EUR"
  const allocations: TripCheckoutAllocation[] = []

  for (const component of active) {
    const sourceCurrency = component.componentCurrency ?? collectionCurrency
    const sourceAmountCents = component.componentTotalAmountCents ?? 0
    if (sourceAmountCents <= 0) continue

    if (sourceCurrency === collectionCurrency) {
      allocations.push({
        componentId: component.id,
        kind: component.kind,
        bookingId: component.bookingId,
        orderId: component.orderId,
        sourceCurrency,
        sourceAmountCents,
        targetCurrency: collectionCurrency,
        targetAmountCents: sourceAmountCents,
      })
      continue
    }

    const fx = await quoteFx(c, sourceCurrency, collectionCurrency)
    allocations.push({
      componentId: component.id,
      kind: component.kind,
      bookingId: component.bookingId,
      orderId: component.orderId,
      sourceCurrency,
      sourceAmountCents,
      targetCurrency: collectionCurrency,
      targetAmountCents: convertCents(sourceAmountCents, fx.rate),
      fx: {
        rate: fx.rate,
        provider: "voyant_data_fx",
        quotedAt: fx.quotedAt,
        validUntil: fx.validUntil,
      },
    })
  }

  return {
    currency: collectionCurrency,
    totalAmountCents: allocations.reduce(
      (sum, allocation) => sum + allocation.targetAmountCents,
      0,
    ),
    allocations,
  }
}

function buildTripPaymentSummary(
  trip: Trip,
  currency: string,
  allocations?: TripCheckoutAllocation[],
): string {
  const lines = ["Trip payment summary"]
  const byComponentId = new Map(
    allocations?.map((allocation) => [allocation.componentId, allocation]),
  )
  for (const component of trip.components.filter(
    (item) => item.status !== "removed" && item.status !== "cancelled",
  )) {
    const allocation = byComponentId.get(component.id)
    if (allocation?.fx) {
      lines.push(
        `${componentDisplayName(component)} — ${formatCents(
          allocation.sourceAmountCents,
          allocation.sourceCurrency,
        )} -> ${formatCents(allocation.targetAmountCents, allocation.targetCurrency)}`,
      )
    } else {
      lines.push(
        `${componentDisplayName(component)} — ${formatCents(
          allocation?.targetAmountCents ?? component.componentTotalAmountCents,
          allocation?.targetCurrency ?? component.componentCurrency ?? currency,
        )}`,
      )
    }
  }
  const total = allocations?.reduce((sum, allocation) => sum + allocation.targetAmountCents, 0)
  lines.push(
    `Total payable — ${formatCents(total ?? trip.envelope.aggregateTotalAmountCents, currency)}`,
  )
  const fxAllocations = allocations?.filter((allocation) => allocation.fx) ?? []
  if (fxAllocations.length > 0) {
    lines.push("")
    lines.push("FX rates")
    for (const allocation of fxAllocations) {
      lines.push(
        `${allocation.sourceCurrency}->${allocation.targetCurrency}: ${allocation.fx?.rate} quoted ${allocation.fx?.quotedAt}`,
      )
    }
  }
  return lines.join("\n")
}

function componentDisplayName(component: Trip["components"][number]): string {
  const metadata = asRecord(component.metadata)
  const catalogItem = asRecord(metadata?.catalogItem)
  const flightDraft = asRecord(metadata?.flightDraft)
  const origin = stringValue(flightDraft?.origin)
  const destination = stringValue(flightDraft?.destination)
  if (origin && destination) return `${origin} -> ${destination}`
  return (
    stringValue(catalogItem?.name) ||
    stringValue(component.title) ||
    stringValue(component.description) ||
    component.kind.replaceAll("_", " ")
  )
}

function formatCents(amountCents: number | null | undefined, currency: string): string {
  return ((amountCents ?? 0) / 100).toLocaleString("en-GB", {
    style: "currency",
    currency,
  })
}

interface FxQuote {
  rate: number
  quotedAt: string
  validUntil?: string | null
}

async function quoteFx(
  c: Context,
  sourceCurrency: string,
  targetCurrency: string,
): Promise<FxQuote> {
  if (sourceCurrency === targetCurrency) {
    return { rate: 1, quotedAt: new Date().toISOString(), validUntil: null }
  }

  const env = c.env as {
    VOYANT_API_KEY?: string
    VOYANT_CLOUD_API_KEY?: string
    VOYANT_CLOUD_API_URL?: string
  }
  const apiKey = resolveVoyantApiKey(env)
  if (!apiKey) {
    throw new Error("trip_checkout_fx_requires_voyant_api_key")
  }

  const baseUrl = (env.VOYANT_CLOUD_API_URL ?? "https://api.voyantjs.com").replace(/\/$/, "")
  const url = new URL(
    `/data/fx/v1/fx/pair/${encodeURIComponent(sourceCurrency)}/${encodeURIComponent(
      targetCurrency,
    )}`,
    `${baseUrl}/`,
  )
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      "x-voyant-sdk": "voyant-operator-trips",
    },
  })
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok) {
    throw new Error(`trip_checkout_fx_quote_failed:${response.status}`)
  }

  const body = asRecord(payload?.data) ?? payload
  const rate = numberValue(body?.conversionRate) ?? numberValue(body?.conversion_rate)
  if (!rate || rate <= 0) {
    throw new Error("trip_checkout_fx_quote_invalid")
  }

  return {
    rate,
    quotedAt:
      stringValue(body?.timeLastUpdateUtc) ??
      stringValue(body?.time_last_update_utc) ??
      unixSecondsToIso(
        numberValue(body?.timeLastUpdateUnix) ?? numberValue(body?.time_last_update_unix),
      ) ??
      new Date().toISOString(),
    validUntil:
      stringValue(body?.timeNextUpdateUtc) ??
      stringValue(body?.time_next_update_utc) ??
      unixSecondsToIso(
        numberValue(body?.timeNextUpdateUnix) ?? numberValue(body?.time_next_update_unix),
      ),
  }
}

function convertCents(amountCents: number, rate: number): number {
  return Math.round(amountCents * rate)
}

function unixSecondsToIso(value: number | null): string | null {
  if (!value || !Number.isFinite(value)) return null
  return new Date(value * 1000).toISOString()
}

export interface TripBillingInfo {
  buyerType?: string | null
  personId?: string | null
  organizationId?: string | null
  contact?: {
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phone?: string | null
  }
}

export function readTripBilling(travelerParty: Record<string, unknown>): TripBillingInfo {
  const billing = asRecord(travelerParty.billing)
  const contact = asRecord(billing?.contact)
  return {
    buyerType: stringValue(billing?.buyerType),
    personId: stringValue(billing?.personId),
    organizationId: stringValue(billing?.organizationId),
    contact: {
      firstName: stringValue(contact?.firstName),
      lastName: stringValue(contact?.lastName),
      email: stringValue(contact?.email),
      phone: stringValue(contact?.phone),
    },
  }
}

export function formatTripBillingName(billing: TripBillingInfo): string | null {
  return [billing.contact?.firstName, billing.contact?.lastName]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim()
    ? [billing.contact?.firstName, billing.contact?.lastName]
        .filter((part): part is string => Boolean(part))
        .join(" ")
    : null
}

function synthesizeTripBilling(billing: TripBillingInfo) {
  const names = splitTripBillingName(formatTripBillingName(billing) ?? "Trip customer")
  return {
    email: billing.contact?.email ?? "",
    phone: billing.contact?.phone ?? "0000000000",
    firstName: names.firstName,
    lastName: names.lastName,
    city: "TBD",
    country: 642,
    state: "TBD",
    postalCode: "00000",
    details: "Pending — customer to confirm at payment.",
  }
}

export function splitTripBillingName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] ?? "Trip",
    lastName: parts.slice(1).join(" ") || "Customer",
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

function getDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
}

function getContainer(c: Context): { resolve(key: string): unknown } | undefined {
  return (c.var as { container?: { resolve(key: string): unknown } }).container
}
