import type { PricingBreakdownV1 } from "@voyantjs/catalog/booking-engine"

import { isCatalogBackedTripComponent } from "./catalog-component-adapter.js"
import type { NewTripComponent, TripComponent, TripEnvelope } from "./schema.js"
import type { ComponentCheckoutResult, ReserveComponentResult } from "./service-types.js"
import { TripComposerInvariantError } from "./service-types.js"
import {
  isAllowedTripComponentStatusTransition,
  isTerminalTripComponentStatus,
  type TripComponentPricingSnapshot,
  type TripComponentTaxLine,
  type TripEnvelopePricingSnapshot,
  type UpdateTripComponentInput,
  type UpdateTripComponentRefsInput,
} from "./validation.js"

export function hasCommittedComponentReference(
  component: Pick<
    TripComponent,
    "bookingId" | "bookingGroupId" | "orderId" | "paymentSessionId" | "providerRef" | "supplierRef"
  >,
): boolean {
  return Boolean(
    component.bookingId ||
      component.bookingGroupId ||
      component.orderId ||
      component.paymentSessionId ||
      component.providerRef ||
      component.supplierRef,
  )
}

export function assertTripComponentCanBeUpdated(
  component: TripComponent,
  patch: UpdateTripComponentInput,
): void {
  if (isTerminalTripComponentStatus(component.status)) {
    throw new TripComposerInvariantError(
      `Trip component ${component.id} is ${component.status} and cannot be updated`,
    )
  }

  if (patch.status && !isAllowedTripComponentStatusTransition(component.status, patch.status)) {
    throw new TripComposerInvariantError(
      `Invalid trip component status transition: ${component.status} -> ${patch.status}`,
    )
  }

  if (hasCommittedComponentReference(component) && patch.catalogRef !== undefined) {
    throw new TripComposerInvariantError(
      `Trip component ${component.id} has committed references and cannot change catalog identity`,
    )
  }
}

export function assertTripComponentCanReceiveRefs(
  component: TripComponent,
  refs: UpdateTripComponentRefsInput,
): void {
  if (isTerminalTripComponentStatus(component.status)) {
    throw new TripComposerInvariantError(
      `Trip component ${component.id} is ${component.status} and cannot receive references`,
    )
  }

  if (
    hasCommittedComponentReference(component) &&
    refs.committedRef &&
    Object.keys(refs.committedRef).length > 0
  ) {
    throw new TripComposerInvariantError(
      `Trip component ${component.id} already has committed references`,
    )
  }
}

export function assertTripComponentCanBeReserved(
  component: TripComponent,
  now: Date = new Date(),
): void {
  if (component.status !== "priced") {
    throw new TripComposerInvariantError(
      `Trip component ${component.id} is ${component.status} and must be priced before reserve`,
    )
  }

  if (!isCatalogBackedTripComponent(component)) {
    throw new TripComposerInvariantError(
      `Trip component ${component.id} is not a catalog-backed booking component`,
    )
  }

  if (!component.pricingSnapshot) {
    throw new TripComposerInvariantError(
      `Trip component ${component.id} has no pricing snapshot to reserve`,
    )
  }

  if (component.priceExpiresAt && component.priceExpiresAt.getTime() <= now.getTime()) {
    throw new TripComposerInvariantError(`Trip component ${component.id} price has expired`)
  }
}

export function reserveResultToComponentPatch(
  result: ReserveComponentResult,
): Partial<NewTripComponent> {
  const patch: Partial<NewTripComponent> = {
    status: result.status,
  }

  if (result.bookingId !== undefined) patch.bookingId = result.bookingId
  if (result.bookingGroupId !== undefined) patch.bookingGroupId = result.bookingGroupId
  if (result.orderId !== undefined) patch.orderId = result.orderId
  if (result.paymentSessionId !== undefined) patch.paymentSessionId = result.paymentSessionId
  if (result.providerRef !== undefined) patch.providerRef = result.providerRef
  if (result.supplierRef !== undefined) patch.supplierRef = result.supplierRef
  if (result.holdToken !== undefined) patch.holdToken = result.holdToken
  if (result.holdExpiresAt !== undefined) patch.holdExpiresAt = new Date(result.holdExpiresAt)

  return patch
}

export function shouldReplayReserve(
  envelope: Pick<TripEnvelope, "reserveIdempotencyKey" | "status">,
  idempotencyKey?: string,
): boolean {
  return Boolean(
    idempotencyKey &&
      envelope.reserveIdempotencyKey === idempotencyKey &&
      ["reserved", "checkout_started", "booked"].includes(envelope.status),
  )
}

export function shouldReplayCheckout(
  envelope: Pick<TripEnvelope, "checkoutIdempotencyKey" | "status">,
  idempotencyKey?: string,
): boolean {
  return Boolean(
    idempotencyKey &&
      envelope.checkoutIdempotencyKey === idempotencyKey &&
      ["checkout_started", "booked"].includes(envelope.status),
  )
}

export function assertTripComponentCanStartCheckout(
  component: TripComponent,
  now: Date = new Date(),
): void {
  if (component.status !== "held" && component.status !== "booked") {
    throw new TripComposerInvariantError(
      `Trip component ${component.id} is ${component.status} and must be held or booked before checkout`,
    )
  }

  if (!component.bookingId && !component.orderId) {
    throw new TripComposerInvariantError(
      `Trip component ${component.id} has no booking/order reference for checkout`,
    )
  }

  if (component.holdExpiresAt && component.holdExpiresAt.getTime() <= now.getTime()) {
    throw new TripComposerInvariantError(`Trip component ${component.id} hold has expired`)
  }
}

export function checkoutResultToComponentPatch(
  result: ComponentCheckoutResult,
): Partial<NewTripComponent> {
  const patch: Partial<NewTripComponent> = {
    status: result.status ?? "checkout_started",
  }

  if (result.bookingId !== undefined) patch.bookingId = result.bookingId
  if (result.bookingGroupId !== undefined) patch.bookingGroupId = result.bookingGroupId
  if (result.orderId !== undefined) patch.orderId = result.orderId
  if (result.paymentSessionId !== undefined) patch.paymentSessionId = result.paymentSessionId
  if (result.providerRef !== undefined) patch.providerRef = result.providerRef
  if (result.supplierRef !== undefined) patch.supplierRef = result.supplierRef

  return patch
}

export function pricingSnapshotFromBreakdown(
  pricing: PricingBreakdownV1,
  priceExpiresAt?: string,
  warnings?: string[],
): TripComponentPricingSnapshot {
  return {
    currency: pricing.currency,
    subtotalAmountCents: pricing.subtotal,
    taxAmountCents: pricing.taxTotal,
    totalAmountCents: pricing.total,
    priceExpiresAt,
    warnings,
  }
}

export function taxLinesFromBreakdown(pricing: PricingBreakdownV1): TripComponentTaxLine[] {
  return pricing.taxes.map((tax) => ({
    code: tax.code,
    label: tax.label,
    amountCents: tax.amount,
    baseAmountCents: tax.base,
    rate: tax.rate,
    includedInPrice: tax.includedInPrice,
    source: tax.scope,
  }))
}

export function aggregateComponentPricing(
  components: Array<Pick<TripComponent, "pricingSnapshot" | "warningCodes">>,
  preferredCurrency?: string,
): TripEnvelopePricingSnapshot {
  const priced = components.filter((component) => component.pricingSnapshot)
  const currency = preferredCurrency ?? priced[0]?.pricingSnapshot?.currency ?? "EUR"
  const warnings = new Set<string>()

  let subtotalAmountCents = 0
  let taxAmountCents = 0
  let totalAmountCents = 0
  for (const component of priced) {
    const snapshot = component.pricingSnapshot
    if (!snapshot) continue

    if (snapshot.currency !== currency) {
      warnings.add(`currency_mismatch:${snapshot.currency}`)
      continue
    }

    subtotalAmountCents += snapshot.subtotalAmountCents
    taxAmountCents += snapshot.taxAmountCents
    totalAmountCents += snapshot.totalAmountCents
    for (const warning of snapshot.warnings ?? []) warnings.add(warning)
    for (const warning of component.warningCodes ?? []) warnings.add(warning)
  }

  return {
    currency,
    subtotalAmountCents,
    taxAmountCents,
    totalAmountCents,
    componentCount: components.length,
    pricedComponentCount: priced.length,
    warnings: [...warnings],
  }
}
