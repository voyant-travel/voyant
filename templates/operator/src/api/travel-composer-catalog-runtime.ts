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
import { toCatalogReservationBookingOriginInput, upsertBookingOrigin } from "@voyantjs/bookings"
import type { PricingBasis } from "@voyantjs/catalog/snapshot/schema"
import { createCatalogPromotionEvaluator } from "@voyantjs/commerce/promotions/service-catalog-evaluator"
import type { EventBus } from "@voyantjs/core"
import type { AnyDrizzleDb } from "@voyantjs/db"
import {
  type CancelComponentInput,
  type CancelComponentResult,
  type CatalogComponentQuoteInput,
  type ComponentCancellationPreview,
  type ComponentCancellationPreviewInput,
  type ComponentCheckoutInput,
  type ComponentCheckoutResult,
  type ReleaseReservedComponentInput,
  type ReleaseReservedComponentResult,
  type ReserveComponentInput,
  type ReserveComponentResult,
  toBookingDraftV1,
} from "@voyantjs/travel-composer"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { applyOperatorTaxToQuoteResult } from "./catalog-booking-runtime"
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

export async function quoteCatalogComponent(
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

export async function reserveCatalogComponent(
  c: Context,
  input: ReserveComponentInput,
): Promise<ReserveComponentResult> {
  const db = getDb(c)
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
    db,
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
  if (result.bookingId) {
    await upsertBookingOrigin(
      db,
      toCatalogReservationBookingOriginInput({
        bookingId: result.bookingId,
        tripEnvelopeId: input.envelope.id,
        tripComponentId: component.id,
        catalogPriceResponseId: quoteId,
        catalogSnapshotId: result.snapshotId,
        providerSourceKind: component.sourceKind,
        providerSourceConnectionId: component.sourceConnectionId,
        providerSourceRef: component.sourceRef,
        providerOrderRef: orderRef,
        metadata: {
          entityModule: component.entityModule,
          entityId: component.entityId,
          createAsDraft,
        },
      }),
    )
  }

  return {
    status: bookStatusToComponentStatus(result.status),
    bookingId: result.bookingId,
    orderId: orderRef,
    providerRef: orderRef,
    supplierRef: orderRef,
    warnings: result.status === "held" ? undefined : [`booking_engine_status:${result.status}`],
  }
}

export async function releaseReservedComponent(
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

export async function previewComponentCancellation(
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

export async function cancelComponent(
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

  // Catalog adapters can return "pending" when an async cancel was submitted
  // (email/partner-portal/batch) and the inventory hasn't been released yet.
  // The travel-composer's `CancelComponentResult` doesn't model that state;
  // surface it as `refused` with a reason so the trip lands in remediation
  // and the operator follows up out-of-band. `pending_channel` flows through
  // the reason so the UI can show where the request went.
  const status: CancelComponentResult["status"] =
    result.status === "pending" ? "refused" : result.status
  const reason =
    result.status === "cancelled"
      ? undefined
      : result.status === "pending"
        ? `cancel_pending${result.pendingChannel ? `:${result.pendingChannel}` : ""}`
        : `cancel_${result.status}`

  return {
    status,
    refundAmountCents: result.refundAmount,
    refundCurrency: result.refundCurrency,
    reason,
    snapshot: { snapshotId: result.snapshotId },
  }
}

export async function startComponentCheckout(
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
