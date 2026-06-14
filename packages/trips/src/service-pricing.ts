import type { QuoteResponseV1 } from "@voyantjs/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { eq } from "drizzle-orm"

import { isCatalogBackedTripComponent, toBookingDraftV1 } from "./catalog-component-adapter.js"
import type { TripComponent, TripEnvelope } from "./schema.js"
import { tripComponents, tripEnvelopes } from "./schema.js"
import {
  aggregateComponentPricing,
  assertTripComponentCanBeUpdated,
  pricingSnapshotFromBreakdown,
  taxLinesFromBreakdown,
} from "./service-helpers.js"
import { createComponentEvent, minComponentPriceExpiry } from "./service-internals.js"
import { getTrip } from "./service-trips.js"
import type { PriceTripDeps, PriceTripResult } from "./service-types.js"
import { TripsInvariantError } from "./service-types.js"
import type { PriceTripInput, TripComponentStatus } from "./validation.js"

export async function priceTrip(
  db: AnyDrizzleDb,
  input: PriceTripInput,
  deps: PriceTripDeps,
): Promise<PriceTripResult> {
  const trip = await getTrip(db, input.envelopeId)
  if (!trip) {
    throw new TripsInvariantError(`Trip envelope ${input.envelopeId} was not found`)
  }

  const warnings = new Set<string>()
  const failures: PriceTripResult["failures"] = []
  const pricedComponents: TripComponent[] = []

  for (const component of trip.components) {
    if (component.status === "removed" || component.status === "cancelled") {
      pricedComponents.push(component)
      continue
    }

    if (isCatalogBackedTripComponent(component)) {
      const quote = await deps.quoteCatalogComponent({
        component,
        bookingDraft: toBookingDraftV1(
          component,
          deps.componentBookingDraftOverrides?.[component.id],
        ),
        scope: input.scope,
        ttlMs: input.ttlMs,
      })
      const updated = await applyQuoteToComponent(db, component, quote)
      pricedComponents.push(updated)
      if (!quote.available || !quote.pricing) {
        const reason = quote.invalidReason ?? "quote_unavailable"
        warnings.add(reason)
        failures.push({ componentId: component.id, reason })
      }
      continue
    }

    const updated = await applyPlaceholderPricing(db, component)
    pricedComponents.push(updated)
    for (const warning of updated.warningCodes) warnings.add(warning)
    if (!updated.pricingSnapshot) {
      failures.push({ componentId: component.id, reason: "manual_price_missing" })
    }
  }

  const aggregate = aggregateComponentPricing(pricedComponents, input.scope.currency)
  for (const warning of aggregate.warnings ?? []) warnings.add(warning)
  const pricing = { ...aggregate, warnings: [...warnings] }

  const [envelope] = (await db
    .update(tripEnvelopes)
    .set({
      status: "priced",
      aggregateCurrency: pricing.currency,
      aggregateSubtotalAmountCents: pricing.subtotalAmountCents,
      aggregateTaxAmountCents: pricing.taxAmountCents,
      aggregateTotalAmountCents: pricing.totalAmountCents,
      aggregatePricingSnapshot: pricing,
      currentPriceExpiresAt: minComponentPriceExpiry(pricedComponents),
      updatedAt: new Date(),
    })
    .where(eq(tripEnvelopes.id, input.envelopeId))
    .returning()) as TripEnvelope[]

  if (!envelope) {
    throw new Error("priceTrip: envelope update returned no rows")
  }

  return {
    envelope,
    components: pricedComponents,
    pricing,
    warnings: [...warnings],
    failures,
  }
}

export async function applyQuoteToComponent(
  db: AnyDrizzleDb,
  component: TripComponent,
  quote: QuoteResponseV1,
): Promise<TripComponent> {
  const pricingSnapshot = quote.pricing
    ? pricingSnapshotFromBreakdown(quote.pricing, quote.expiresAt)
    : undefined
  const warningCodes = quote.invalidReason ? [quote.invalidReason] : []
  const nextStatus: TripComponentStatus =
    quote.available && quote.pricing ? "priced" : "unavailable"

  assertTripComponentCanBeUpdated(component, { status: nextStatus })

  const [updated] = (await db
    .update(tripComponents)
    .set({
      status: nextStatus,
      catalogQuoteId: quote.quoteId,
      componentCurrency: pricingSnapshot?.currency ?? null,
      componentSubtotalAmountCents: pricingSnapshot?.subtotalAmountCents ?? null,
      componentTaxAmountCents: pricingSnapshot?.taxAmountCents ?? null,
      componentTotalAmountCents: pricingSnapshot?.totalAmountCents ?? null,
      pricingSnapshot,
      taxLines: quote.pricing ? taxLinesFromBreakdown(quote.pricing) : [],
      priceExpiresAt: quote.expiresAt ? new Date(quote.expiresAt) : null,
      warningCodes,
      updatedAt: new Date(),
    })
    .where(eq(tripComponents.id, component.id))
    .returning()) as TripComponent[]

  if (!updated) {
    throw new Error(`applyQuoteToComponent: update returned no row for ${component.id}`)
  }

  await createComponentEvent(db, {
    envelopeId: updated.envelopeId,
    componentId: updated.id,
    eventType: "priced",
    fromStatus: component.status,
    toStatus: updated.status,
    payload: {
      quoteId: quote.quoteId,
      available: quote.available,
      invalidReason: quote.invalidReason,
    },
  })

  return updated
}

async function applyPlaceholderPricing(
  db: AnyDrizzleDb,
  component: TripComponent,
): Promise<TripComponent> {
  const warningCodes = component.pricingSnapshot
    ? ["manual_placeholder_price"]
    : ["manual_price_missing"]
  const nextStatus: TripComponentStatus = component.pricingSnapshot ? "priced" : "unavailable"

  assertTripComponentCanBeUpdated(component, { status: nextStatus })

  const [updated] = (await db
    .update(tripComponents)
    .set({
      status: nextStatus,
      warningCodes,
      updatedAt: new Date(),
    })
    .where(eq(tripComponents.id, component.id))
    .returning()) as TripComponent[]

  if (!updated) {
    throw new Error(`applyPlaceholderPricing: update returned no row for ${component.id}`)
  }

  await createComponentEvent(db, {
    envelopeId: updated.envelopeId,
    componentId: updated.id,
    eventType: "priced",
    fromStatus: component.status,
    toStatus: updated.status,
    payload: { placeholder: true },
  })

  return updated
}
