import {
  type BookEntityResult,
  type BookingDraftV1,
  bookEntity,
  bookingDraftV1,
  cancelEntity,
  type PricingBreakdownV1,
  type QuoteEntityResult,
  type QuoteResponseV1,
  quoteEntity,
  quoteResponseV1,
} from "@voyantjs/catalog/booking-engine"
import type { PricingBasis } from "@voyantjs/catalog/snapshot/schema"
import type { EventBus } from "@voyantjs/core"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { financeService, type PaymentCompletedEvent } from "@voyantjs/finance"
import type {
  AncillarySelection,
  FlightBookRequest,
  FlightOffer,
  FlightPassenger,
  PassengerType,
} from "@voyantjs/flights/contract/types"
import type { HonoBundle } from "@voyantjs/hono/plugin"
import { createDemoFlightAdapter } from "@voyantjs/plugin-flights-demo"
import {
  NETOPIA_RUNTIME_CONTAINER_KEY,
  netopiaService,
  type ResolvedNetopiaRuntimeOptions,
} from "@voyantjs/plugin-netopia"
import { createCatalogPromotionEvaluator } from "@voyantjs/promotions/service-catalog-evaluator"
import {
  type CancelComponentInput,
  type CancelComponentResult,
  type CancelTripComponentsDeps,
  type CatalogComponentQuoteInput,
  type ComponentCancellationPreview,
  type ComponentCancellationPreviewInput,
  type ComponentCheckoutInput,
  type ComponentCheckoutResult,
  type PriceTripDeps,
  type ReleaseReservedComponentInput,
  type ReleaseReservedComponentResult,
  type ReserveComponentInput,
  type ReserveComponentPreflightResult,
  type ReserveComponentResult,
  type ReserveTripDeps,
  type StartCheckoutDeps,
  type TravelComposerRoutesOptions,
  type Trip,
  type TripCheckoutInput,
  type TripCheckoutResult,
  toBookingDraftV1,
  travelComposerService,
} from "@voyantjs/travel-composer"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { applyOperatorTaxToQuoteResult } from "./catalog-booking"
import {
  CatalogCheckoutStartError,
  type CatalogCheckoutStartResult,
  type CheckoutStartInput,
  startCatalogCheckout,
} from "./catalog-checkout"
import {
  getBookingEngineRegistryFromContext,
  getOwnedBookingHandlerRegistryFromContext,
} from "./lib/booking-engine-runtime"
import { withDbFromEnv } from "./lib/db"

export function createOperatorTravelComposerRoutesOptions(): TravelComposerRoutesOptions {
  return {
    priceTripDeps: (c) => createPriceTripDeps(c),
    reserveTripDeps: (c) => createReserveTripDeps(c),
    startCheckoutDeps: (c) => createStartCheckoutDeps(c),
    cancelTripComponentsDeps: (c) => createCancelTripComponentsDeps(c),
  }
}

export const travelComposerPaymentBundle: HonoBundle = {
  name: "travel-composer-payment-completion",
  bootstrap: ({ bindings, eventBus }) => {
    const env = bindings as CloudflareBindings
    eventBus.subscribe<PaymentCompletedEvent>("payment.completed", async ({ data }) => {
      if (data.targetType !== "other" || !data.targetId?.startsWith("trip_")) return

      try {
        await withDbFromEnv(env, async (rawDb) => {
          const db = rawDb as unknown as PostgresJsDatabase
          await travelComposerService.completeTripCheckout(db, {
            envelopeId: data.targetId ?? undefined,
            paymentSessionId: data.paymentSessionId,
            payload: {
              amountCents: data.amountCents,
              currency: data.currency,
              provider: data.provider,
              targetType: data.targetType,
              targetId: data.targetId,
            },
          })
        })
      } catch (err) {
        console.error("[travel-composer] payment completion failed", err)
      }
    })
  },
}

function createPriceTripDeps(c: Context): PriceTripDeps {
  return {
    quoteCatalogComponent: (input) => quoteCatalogComponent(c, input),
  }
}

function createReserveTripDeps(c: Context): ReserveTripDeps {
  return {
    quoteCatalogComponentBeforeReserve: (input) => quoteCatalogComponent(c, input),
    validateNonCatalogComponentBeforeReserve: (input) =>
      validateNonCatalogComponentBeforeReserve(c, input),
    reserveCatalogComponent: (input) => reserveCatalogComponent(c, input),
    reserveNonCatalogComponent: (input) => reserveNonCatalogComponent(c, input),
    releaseCatalogComponent: (input) => releaseReservedComponent(c, input),
  }
}

function createStartCheckoutDeps(c: Context): StartCheckoutDeps {
  return {
    startTripCheckout: (input) => startTripCheckout(c, input),
    startComponentCheckout: (input) => startComponentCheckout(c, input),
  }
}

function createCancelTripComponentsDeps(c: Context): CancelTripComponentsDeps {
  return {
    previewComponentCancellation: (input) => previewComponentCancellation(input),
    cancelComponent: (input) => cancelComponent(c, input),
  }
}

async function quoteCatalogComponent(
  c: Context,
  input: CatalogComponentQuoteInput,
): Promise<QuoteResponseV1> {
  const db = getDb(c)
  const component = input.component
  const entityModule = required(component.entityModule, "component.entityModule")
  const entityId = required(component.entityId, "component.entityId")
  const sourceKind = required(component.sourceKind, "component.sourceKind")
  const result = await quoteEntity(
    db,
    {
      registry: getBookingEngineRegistryFromContext(c),
      ownedHandlers: getOwnedBookingHandlerRegistryFromContext(c),
      evaluatePromotions: createCatalogPromotionEvaluator(db),
    },
    {
      entityModule,
      entityId,
      sourceKind,
      sourceConnectionId: component.sourceConnectionId ?? undefined,
      sourceRef: component.sourceRef ?? undefined,
      scope: {
        locale: input.scope.locale ?? "en-GB",
        audience: input.scope.audience ?? "staff",
        market: input.scope.market ?? "default",
        currency: input.scope.currency,
      },
      parameters: engineParametersFromBookingDraft(undefined, input.bookingDraft),
      ttlMs: input.ttlMs,
      adapterContext: adapterContext(c, component.sourceConnectionId ?? sourceKind),
    },
  )
  const transformed = await applyOperatorTaxToQuoteResult(
    db,
    result,
    entityModule,
    entityId,
    sourceKind,
  )
  return serializeQuoteResult(transformed)
}

async function reserveCatalogComponent(
  c: Context,
  input: ReserveComponentInput,
): Promise<ReserveComponentResult> {
  const component = input.component
  const quoteId = required(component.catalogQuoteId, "component.catalogQuoteId")
  const bookingDraft = bookingDraftFromComponent(component)
  // The trip composer can start underlying bookings in draft status. When the
  // operator leaves that option unchecked, the resulting booking lands in
  // `awaiting_payment`. The owned products handler reads this off
  // `request.parameters.initialStatus` and forwards it to the bridge.
  const createAsDraft = readBoolean(input.envelope.constraints?.createAsDraft)
  const initialStatus = createAsDraft ? "draft" : "awaiting_payment"
  const result = await bookEntity(
    getDb(c),
    {
      registry: getBookingEngineRegistryFromContext(c),
      ownedHandlers: getOwnedBookingHandlerRegistryFromContext(c),
    },
    {
      quoteId,
      party: {
        draft: bookingDraft,
        travelerParty: input.envelope.travelerParty,
      },
      paymentIntent: { type: "hold" },
      parameters: { ...engineParametersFromBookingDraft(undefined, bookingDraft), initialStatus },
      idempotencyKey: componentReserveIdempotencyKey(component.id, quoteId),
      adapterContext: adapterContext(c, component.sourceConnectionId ?? component.sourceKind),
    },
  )

  if (result.status === "failed") {
    throw new Error("component_reservation_failed")
  }

  const orderRef = result.orderRef || result.snapshotId
  return {
    status: bookStatusToComponentStatus(result.status),
    bookingId: result.bookingId,
    orderId: orderRef,
    providerRef: orderRef,
    supplierRef: orderRef,
    warnings: result.status === "held" ? undefined : [`booking_engine_status:${result.status}`],
  }
}

async function releaseReservedComponent(
  c: Context,
  input: ReleaseReservedComponentInput,
): Promise<ReleaseReservedComponentResult> {
  const component = input.component
  if (!component.bookingId || !component.entityModule || !component.entityId) {
    return { released: false, reason: "missing_component_booking_ref" }
  }

  try {
    const result = await cancelEntity(
      getDb(c),
      { registry: getBookingEngineRegistryFromContext(c) },
      {
        bookingId: component.bookingId,
        entityModule: component.entityModule,
        entityId: component.entityId,
        reason: "Travel composer compensation",
        adapterContext: adapterContext(c, component.sourceConnectionId ?? component.sourceKind),
      },
    )
    return {
      released: result.status === "cancelled",
      reason: result.status === "refused" ? "cancel_refused" : undefined,
    }
  } catch (error) {
    return {
      released: false,
      reason: error instanceof Error ? error.message : "release_failed",
    }
  }
}

async function validateNonCatalogComponentBeforeReserve(
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

async function reserveNonCatalogComponent(
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

async function previewComponentCancellation(
  input: ComponentCancellationPreviewInput,
): Promise<ComponentCancellationPreview> {
  const component = input.component
  if (!component.bookingId || !component.entityModule || !component.entityId) {
    return {
      componentId: component.id,
      action: "staff_remediation",
      currentStatus: component.status,
      staffActionRequired: true,
      reason: "missing_component_booking_ref",
    }
  }

  return {
    componentId: component.id,
    action: "cancel",
    currentStatus: component.status,
    staffActionRequired: false,
    refundAmountCents: 0,
    refundCurrency: component.componentCurrency ?? undefined,
    penaltyAmountCents: 0,
    policySummary:
      "Supplier cancellation preview is not available; cancellation result is authoritative.",
    snapshot: {
      bookingId: component.bookingId,
      entityModule: component.entityModule,
      entityId: component.entityId,
      sourceKind: component.sourceKind,
    },
  }
}

async function cancelComponent(
  c: Context,
  input: CancelComponentInput,
): Promise<CancelComponentResult> {
  const component = input.component
  if (!component.bookingId || !component.entityModule || !component.entityId) {
    return { status: "refused", reason: "missing_component_booking_ref" }
  }

  const result = await cancelEntity(
    getDb(c),
    { registry: getBookingEngineRegistryFromContext(c) },
    {
      bookingId: component.bookingId,
      entityModule: component.entityModule,
      entityId: component.entityId,
      reason: input.reason,
      adapterContext: adapterContext(c, component.sourceConnectionId ?? component.sourceKind),
    },
  )

  return {
    status: result.status,
    refundAmountCents: result.refundAmount,
    refundCurrency: result.refundCurrency,
    reason: result.status === "cancelled" ? undefined : `cancel_${result.status}`,
    snapshot: { snapshotId: result.snapshotId },
  }
}

async function startComponentCheckout(
  c: Context,
  input: ComponentCheckoutInput,
): Promise<ComponentCheckoutResult> {
  const bookingId = required(input.component.bookingId, "component.bookingId")
  const checkoutInput: CheckoutStartInput = {
    ...(input.request as Partial<CheckoutStartInput>),
    bookingId,
    paymentIntent: input.intent,
  }

  try {
    return checkoutResultToComponentResult(
      await startCatalogCheckout(
        {
          db: getDb(c) as PostgresJsDatabase,
          env: c.env as CloudflareBindings & Record<string, string | undefined>,
          eventBus: getEventBus(c),
          resolveRuntime: (key) => getContainer(c)?.resolve(key),
          requestMeta: checkoutRequestMeta(c),
        },
        checkoutInput,
      ),
    )
  } catch (error) {
    if (error instanceof CatalogCheckoutStartError) {
      throw new Error(error.code)
    }
    throw error
  }
}

async function startTripCheckout(
  c: Context,
  input: TripCheckoutInput,
): Promise<TripCheckoutResult> {
  const db = getDb(c) as unknown as Parameters<typeof financeService.createPaymentSession>[0]
  const pricing = await checkoutPricingForTrip(c, input.trip, input.request)
  if (pricing.totalAmountCents <= 0) {
    throw new Error("trip_checkout_total_required")
  }

  const billing = readBilling(input.trip.envelope.travelerParty)
  const payerName = formatBillingName(billing)
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
      console.warn("[travel-composer] netopia start failed for trip payment session:", error)
    }
  }

  return {
    kind: input.intent === "bank_transfer" ? "bank_transfer_instructions" : "payment_session",
    paymentSessionId: session.id,
    checkoutUrl: `/pay/${session.id}`,
  }
}

function checkoutResultToComponentResult(
  result: CatalogCheckoutStartResult,
): ComponentCheckoutResult {
  switch (result.kind) {
    case "card_redirect":
      return {
        kind: "card_redirect",
        bookingId: result.bookingId,
        paymentSessionId: result.paymentSessionId,
        checkoutUrl: result.redirectUrl,
      }
    case "bank_transfer_instructions":
      return {
        kind: "bank_transfer_instructions",
        bookingId: result.bookingId,
        paymentSessionId: result.paymentSessionId ?? undefined,
        bankTransferInstructions: result.instructions,
      }
    case "inquiry_received":
      return {
        kind: "inquiry_received",
        bookingId: result.bookingId,
        providerRef: result.inquiryId,
      }
    case "hold_placed":
      return {
        kind: "hold_placed",
        bookingId: result.bookingId,
      }
  }
}

function bookingDraftFromComponent(
  component: Parameters<typeof toBookingDraftV1>[0] & { metadata: Record<string, unknown> },
): BookingDraftV1 {
  const metadata = component.metadata
  const candidate = metadata.bookingDraftV1 ?? metadata.bookingDraft
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    return bookingDraftV1.parse(candidate)
  }
  return toBookingDraftV1(component)
}

function serializeQuoteResult(result: QuoteEntityResult): QuoteResponseV1 {
  return quoteResponseV1.parse({
    ...result,
    quotedAt: result.quotedAt.toISOString(),
    expiresAt: result.expiresAt.toISOString(),
    pricing: toPricingBreakdownV1(result.pricing),
  })
}

function toPricingBreakdownV1(basis: PricingBasis | undefined): PricingBreakdownV1 | undefined {
  if (!basis) return undefined
  if (basis.breakdown) {
    const breakdown = basis.breakdown as PricingBreakdownV1
    if (breakdown.currency && Array.isArray(breakdown.lines) && Array.isArray(breakdown.taxes)) {
      return breakdown
    }
  }

  const lines: PricingBreakdownV1["lines"] = [
    {
      kind: "base",
      label: "Base",
      quantity: 1,
      unitAmount: basis.base_amount,
      totalAmount: basis.base_amount,
    },
  ]
  if (basis.fees > 0) {
    lines.push({ kind: "fee", label: "Fees", unitAmount: basis.fees, totalAmount: basis.fees })
  }
  if (basis.surcharges > 0) {
    lines.push({
      kind: "supplement",
      label: "Surcharges",
      unitAmount: basis.surcharges,
      totalAmount: basis.surcharges,
    })
  }

  const subtotal = basis.base_amount + basis.fees + basis.surcharges
  return {
    currency: basis.currency,
    lines,
    taxes:
      basis.taxes > 0
        ? [
            {
              code: "tax",
              label: "Tax",
              rate: 0,
              amount: basis.taxes,
              base: basis.base_amount,
            },
          ]
        : [],
    subtotal,
    taxTotal: basis.taxes,
    total: subtotal + basis.taxes,
  }
}

function bookStatusToComponentStatus(status: BookEntityResult["status"]): "held" | "booked" {
  return status === "held" ? "held" : "booked"
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

function moneyToCents(amount: string): number {
  const parsed = Number.parseFloat(amount)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function isExpiredOffer(offer: FlightOffer): boolean {
  const expiresAt = offer.expiresAt ? new Date(offer.expiresAt) : null
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now())
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

  const env = c.env as { VOYANT_CLOUD_API_KEY?: string; VOYANT_CLOUD_API_URL?: string }
  if (!env.VOYANT_CLOUD_API_KEY) {
    throw new Error("trip_checkout_fx_requires_voyant_cloud_api_key")
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
      authorization: `Bearer ${env.VOYANT_CLOUD_API_KEY}`,
      "x-voyant-sdk": "voyant-operator-travel-composer",
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

function flightPassengersFromTravelerParty(travelerParty: Record<string, unknown>) {
  const travelers = Array.isArray(travelerParty.travelers)
    ? (travelerParty.travelers as unknown[])
    : []
  const passengers = travelers.map((traveler, index) =>
    flightPassengerFromTraveler(asRecord(traveler) ?? {}, index),
  )
  if (passengers.length > 0) return passengers

  const billing = readBilling(travelerParty)
  const names = splitName(formatBillingName(billing) ?? "Lead traveler")
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
  const billing = readBilling(travelerParty)
  return {
    ...(billing.contact?.email ? { email: billing.contact.email } : {}),
    ...(billing.contact?.phone ? { phone: billing.contact.phone } : {}),
  }
}

interface TripBillingInfo {
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

function readBilling(travelerParty: Record<string, unknown>): TripBillingInfo {
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

function formatBillingName(billing: TripBillingInfo): string | null {
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
  const names = splitName(formatBillingName(billing) ?? "Trip customer")
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

function splitName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] ?? "Trip",
    lastName: parts.slice(1).join(" ") || "Customer",
  }
}

function componentReserveIdempotencyKey(componentId: string, quoteId: string): string {
  return `travel-composer:${componentId}:${quoteId}`.slice(0, 128)
}

function adapterContext(c: Context, connectionId: string | null | undefined) {
  return {
    connection_id: connectionId ?? "engine",
    correlation_id: c.req.header("x-request-id") ?? cryptoRandom(),
  }
}

function engineParametersFromBookingDraft(
  parameters: Record<string, unknown> | undefined,
  bookingDraftPayload: unknown,
): Record<string, unknown> {
  const bookingDraft = asRecord(bookingDraftPayload)
  const configure = asRecord(bookingDraft?.configure)
  const departureSlotId = stringValue(configure?.departureSlotId)
  const paxCount = sumBookingDraftPax(configure?.pax)
  const next: Record<string, unknown> = {
    ...(parameters ?? {}),
    ...(bookingDraft ? { draft: bookingDraft } : {}),
  }

  if (departureSlotId) {
    if (next.departureSlotId == null) next.departureSlotId = departureSlotId
    if (next.departure_id == null) next.departure_id = departureSlotId
    if (next.slotId == null) next.slotId = departureSlotId
  }
  if (paxCount > 0 && next.paxCount == null) {
    next.paxCount = paxCount
  }

  const promotionCode = stringValue(bookingDraft?.promotionCode)
  if (promotionCode && next.promotionCode == null) {
    next.promotionCode = promotionCode
  }

  return next
}

function readBoolean(value: unknown): boolean {
  return value === true
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

function sumBookingDraftPax(value: unknown): number {
  const pax = asRecord(value)
  if (!pax) return 0
  let total = 0
  for (const count of Object.values(pax)) {
    if (typeof count === "number" && Number.isFinite(count) && count > 0) {
      total += count
    }
  }
  return total
}

function getDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
}

function getEventBus(c: Context): EventBus | undefined {
  return (c.var as { eventBus?: EventBus }).eventBus
}

function getContainer(c: Context): { resolve(key: string): unknown } | undefined {
  return (c.var as { container?: { resolve(key: string): unknown } }).container
}

function checkoutRequestMeta(c: Context) {
  return {
    clientIp:
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "",
    userAgent: c.req.header("user-agent") ?? "",
  }
}

function required(value: string | null | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required`)
  return value
}

function cryptoRandom(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
