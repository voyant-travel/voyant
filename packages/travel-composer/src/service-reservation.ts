import type { AnyDrizzleDb } from "@voyantjs/db"
import { and, eq } from "drizzle-orm"

import { isCatalogBackedTripComponent, toBookingDraftV1 } from "./catalog-component-adapter.js"
import type { NewTripEnvelope, TripComponent, TripEnvelope } from "./schema.js"
import { tripComponents, tripEnvelopes } from "./schema.js"
import {
  aggregateComponentPricing,
  assertTripComponentCanBeReserved,
  assertTripComponentCanBeUpdated,
  reserveResultToComponentPatch,
  shouldReplayReserve,
} from "./service-helpers.js"
import {
  appendWarningCodes,
  commonString,
  createComponentEvent,
  markComponentForStaffRemediation,
  minComponentPriceExpiry,
  statusToEventType,
} from "./service-internals.js"
import { applyQuoteToComponent } from "./service-pricing.js"
import { getTrip } from "./service-trips.js"
import type {
  ReleaseReservedComponentResult,
  ReserveComponentResult,
  ReserveTripDeps,
  ReserveTripResult,
  Trip,
} from "./service-types.js"
import { TravelComposerInvariantError } from "./service-types.js"
import { assertTripTravelerPartyComplete } from "./traveler-party-validation.js"
import { isAllowedTripComponentStatusTransition, type ReserveTripInput } from "./validation.js"

export async function reserveTrip(
  db: AnyDrizzleDb,
  input: ReserveTripInput,
  deps: ReserveTripDeps,
): Promise<ReserveTripResult> {
  let trip = await getTrip(db, input.envelopeId)
  if (!trip) {
    throw new TravelComposerInvariantError(`Trip envelope ${input.envelopeId} was not found`)
  }

  if (shouldReplayReserve(trip.envelope, input.idempotencyKey)) {
    return reserveReplayResult(trip)
  }

  if (trip.envelope.status !== "priced") {
    return reserveClaimConflictResult(trip)
  }

  assertTripTravelerPartyComplete(trip.envelope.travelerParty, "Trip reserve")

  const [claimedEnvelope] = (await db
    .update(tripEnvelopes)
    .set({
      status: "reserve_in_progress",
      reserveIdempotencyKey: input.idempotencyKey ?? null,
      reserveStartedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(tripEnvelopes.id, input.envelopeId), eq(tripEnvelopes.status, "priced")))
    .returning()) as TripEnvelope[]

  if (!claimedEnvelope) {
    const refreshed = await getTrip(db, input.envelopeId)
    if (!refreshed) {
      throw new TravelComposerInvariantError(`Trip envelope ${input.envelopeId} was not found`)
    }

    if (shouldReplayReserve(refreshed.envelope, input.idempotencyKey)) {
      return reserveReplayResult(refreshed)
    }

    return reserveClaimConflictResult(refreshed)
  }

  trip = { envelope: claimedEnvelope, components: trip.components }

  let preflight: Awaited<ReturnType<typeof refreshComponentsBeforeReserve>>
  try {
    preflight = await refreshComponentsBeforeReserve(db, trip, input, deps)
  } catch (error) {
    await releaseReserveClaimAfterPreflightFailure(db, input, trip)
    throw error
  }
  if (preflight.failures.length > 0) {
    const envelope = await releaseReserveClaimAfterPreflightFailure(db, input, preflight.trip)
    return {
      envelope,
      components: preflight.trip.components,
      reserved: [],
      failures: preflight.failures,
      compensations: [],
      warnings: preflight.warnings,
    }
  }
  trip = preflight.trip

  const warnings = new Set<string>()
  const failures: ReserveTripResult["failures"] = []
  const reserved: Array<{
    component: TripComponent
    result: ReserveComponentResult
  }> = []
  const componentsById = new Map(trip.components.map((component) => [component.id, component]))

  for (const component of trip.components) {
    if (component.status === "removed" || component.status === "cancelled") {
      continue
    }

    // Non-catalog-backed components (manual_placeholder, flight_placeholder,
    // etc.) can either be reserved by a vertical hook (flights, insurance,
    // transfer connectors) or held internally when no external reservation
    // system exists.
    if (!isCatalogBackedTripComponent(component)) {
      try {
        const result = await deps.reserveNonCatalogComponent?.({
          envelope: trip.envelope,
          component,
        })
        if (result) {
          const updated = await applyReserveResultToComponent(db, component, result)
          componentsById.set(updated.id, updated)
          reserved.push({ component: updated, result })
          for (const warning of result.warnings ?? []) warnings.add(warning)
        } else {
          const held = await holdNonCatalogComponent(db, component)
          componentsById.set(held.id, held)
          reserved.push({
            component: held,
            result: { status: "held", warnings: undefined },
          })
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : "internal_hold_failed"
        warnings.add(reason)
        failures.push({ componentId: component.id, reason })
      }
      continue
    }

    try {
      assertTripComponentCanBeReserved(component)
      const result = await deps.reserveCatalogComponent({ envelope: trip.envelope, component })
      const updated = await applyReserveResultToComponent(db, component, result)
      componentsById.set(updated.id, updated)
      reserved.push({ component: updated, result })
      for (const warning of result.warnings ?? []) warnings.add(warning)
    } catch (error) {
      const reason = error instanceof Error ? error.message : "reservation_failed"
      warnings.add(reason)
      failures.push({ componentId: component.id, reason })
      const failed = await applyReservationFailureToComponent(db, component, reason)
      componentsById.set(failed.id, failed)

      const compensations = await compensateReservedComponents(db, reserved, deps)
      for (const compensation of compensations) {
        if (compensation.status !== "released") warnings.add(compensation.status)
      }

      const [failedEnvelope] = (await db
        .update(tripEnvelopes)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(tripEnvelopes.id, input.envelopeId))
        .returning()) as TripEnvelope[]

      if (!failedEnvelope) {
        throw new Error("reserveTrip: failed envelope update returned no rows")
      }

      const refreshed = await getTrip(db, input.envelopeId)

      return {
        envelope: failedEnvelope,
        components: refreshed?.components ?? [...componentsById.values()],
        reserved: reserved.map((item) => ({
          componentId: item.component.id,
          status: item.component.status as "held" | "booked",
        })),
        failures,
        compensations,
        warnings: [...warnings],
      }
    }
  }

  const refs = commonEnvelopeRefs(reserved.map(({ result }) => result))
  const [envelope] = (await db
    .update(tripEnvelopes)
    .set({
      status: "reserved",
      ...refs,
      reservedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tripEnvelopes.id, input.envelopeId))
    .returning()) as TripEnvelope[]

  if (!envelope) {
    throw new Error("reserveTrip: envelope update returned no rows")
  }

  const refreshed = await getTrip(db, input.envelopeId)

  return {
    envelope,
    components: refreshed?.components ?? [...componentsById.values()],
    reserved: reserved.map((item) => ({
      componentId: item.component.id,
      status: item.component.status as "held" | "booked",
    })),
    failures,
    compensations: [],
    warnings: [...warnings],
  }
}

function reserveReplayResult(trip: Trip): ReserveTripResult {
  return {
    envelope: trip.envelope,
    components: trip.components,
    reserved: trip.components
      .filter(isReservedTripComponent)
      .map((component) => ({ componentId: component.id, status: component.status })),
    failures: [],
    compensations: [],
    warnings: ["idempotent_replay"],
  }
}

function reserveClaimConflictResult(trip: Trip): ReserveTripResult {
  const reason = reserveClaimConflictReason(trip.envelope)
  const componentId = reserveClaimConflictComponentId(trip)

  return {
    envelope: trip.envelope,
    components: trip.components,
    reserved: trip.components
      .filter(isReservedTripComponent)
      .map((component) => ({ componentId: component.id, status: component.status })),
    failures: [{ componentId, reason, code: reason }],
    compensations: [],
    warnings: [reason],
  }
}

function reserveClaimConflictReason(envelope: TripEnvelope): string {
  if (envelope.status === "reserve_in_progress") return "reservation_in_progress"
  if (["reserved", "checkout_started", "booked"].includes(envelope.status)) {
    return "reservation_already_completed"
  }
  return `trip_${envelope.status}_cannot_be_reserved`
}

function reserveClaimConflictComponentId(trip: Trip): string {
  return (
    trip.components.find(
      (component) => component.status !== "removed" && component.status !== "cancelled",
    )?.id ?? trip.envelope.id
  )
}

async function releaseReserveClaimAfterPreflightFailure(
  db: AnyDrizzleDb,
  input: ReserveTripInput,
  trip: Trip,
): Promise<TripEnvelope> {
  const [envelope] = (await db
    .update(tripEnvelopes)
    .set({
      status: "priced",
      reserveIdempotencyKey: null,
      reserveStartedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(tripEnvelopes.id, input.envelopeId), eq(tripEnvelopes.status, "reserve_in_progress")),
    )
    .returning()) as TripEnvelope[]

  return envelope ?? trip.envelope
}

async function refreshComponentsBeforeReserve(
  db: AnyDrizzleDb,
  trip: Trip,
  input: ReserveTripInput,
  deps: ReserveTripDeps,
): Promise<{
  trip: Trip
  failures: ReserveTripResult["failures"]
  warnings: string[]
}> {
  const warnings = new Set<string>()
  const failures: ReserveTripResult["failures"] = []
  let changed = false
  const componentsById = new Map(trip.components.map((component) => [component.id, component]))

  for (const component of trip.components) {
    if (component.status === "removed" || component.status === "cancelled") continue

    if (isCatalogBackedTripComponent(component)) {
      if (!deps.quoteCatalogComponentBeforeReserve) continue
      const quote = await deps.quoteCatalogComponentBeforeReserve({
        component,
        bookingDraft: toBookingDraftV1(component),
        scope: input.refreshScope ?? defaultReserveRefreshScope(trip.envelope),
      })
      const updated = await applyQuoteToComponent(db, component, quote)
      componentsById.set(updated.id, updated)
      changed = true

      if (!quote.available || !quote.pricing) {
        const reason = quote.invalidReason ?? "quote_unavailable"
        warnings.add(reason)
        failures.push({
          componentId: component.id,
          reason,
          code: "unavailable",
          details: { quoteId: quote.quoteId },
        })
        continue
      }

      if (componentPricingChanged(component, updated)) {
        warnings.add("price_changed")
        failures.push({
          componentId: component.id,
          reason: "price_changed",
          code: "price_changed",
          details: pricingChangeDetails(component, updated),
        })
      }
      continue
    }

    const result = await deps.validateNonCatalogComponentBeforeReserve?.({
      envelope: trip.envelope,
      component,
    })
    if (!result || result.status === "ok") {
      for (const warning of result?.warnings ?? []) warnings.add(warning)
      continue
    }

    const reason = result.reason ?? result.status
    warnings.add(reason)
    failures.push({
      componentId: component.id,
      reason,
      code: result.status,
      details: result.details,
    })
  }

  if (changed || failures.length > 0) {
    const components = [...componentsById.values()]
    const aggregate = aggregateComponentPricing(
      components,
      input.refreshScope?.currency ?? trip.envelope.aggregateCurrency ?? undefined,
    )
    const [envelope] = (await db
      .update(tripEnvelopes)
      .set({
        status: trip.envelope.status,
        aggregateCurrency: aggregate.currency,
        aggregateSubtotalAmountCents: aggregate.subtotalAmountCents,
        aggregateTaxAmountCents: aggregate.taxAmountCents,
        aggregateTotalAmountCents: aggregate.totalAmountCents,
        aggregatePricingSnapshot: aggregate,
        currentPriceExpiresAt: minComponentPriceExpiry(components),
        updatedAt: new Date(),
      })
      .where(eq(tripEnvelopes.id, trip.envelope.id))
      .returning()) as TripEnvelope[]

    const refreshed = await getTrip(db, trip.envelope.id)
    return {
      trip: refreshed ?? { envelope: envelope ?? trip.envelope, components },
      failures,
      warnings: [...warnings, ...(aggregate.warnings ?? [])],
    }
  }

  return { trip, failures, warnings: [...warnings] }
}

function defaultReserveRefreshScope(
  envelope: TripEnvelope,
): NonNullable<ReserveTripInput["refreshScope"]> {
  return {
    locale: "en-US",
    audience: "staff",
    market: "default",
    currency: envelope.aggregateCurrency ?? undefined,
  }
}

function componentPricingChanged(before: TripComponent, after: TripComponent): boolean {
  return (
    before.componentCurrency !== after.componentCurrency ||
    before.componentSubtotalAmountCents !== after.componentSubtotalAmountCents ||
    before.componentTaxAmountCents !== after.componentTaxAmountCents ||
    before.componentTotalAmountCents !== after.componentTotalAmountCents
  )
}

function pricingChangeDetails(
  before: TripComponent,
  after: TripComponent,
): Record<string, unknown> {
  return {
    previous: {
      currency: before.componentCurrency,
      subtotalAmountCents: before.componentSubtotalAmountCents,
      taxAmountCents: before.componentTaxAmountCents,
      totalAmountCents: before.componentTotalAmountCents,
    },
    current: {
      currency: after.componentCurrency,
      subtotalAmountCents: after.componentSubtotalAmountCents,
      taxAmountCents: after.componentTaxAmountCents,
      totalAmountCents: after.componentTotalAmountCents,
    },
  }
}

// Internal "reservation" for manual / placeholder components — no supplier
// dispatch, no booking engine. We just flip status to `held` so the envelope
// can move on to `reserved` and downstream totals/cancellation flows treat
// the line item as locked in.
async function holdNonCatalogComponent(
  db: AnyDrizzleDb,
  component: TripComponent,
): Promise<TripComponent> {
  if (component.status === "held" || component.status === "booked") {
    return component
  }
  if (!isAllowedTripComponentStatusTransition(component.status, "held")) {
    throw new TravelComposerInvariantError(
      `Trip component ${component.id} is ${component.status} and cannot be held`,
    )
  }
  const [updated] = (await db
    .update(tripComponents)
    .set({ status: "held", updatedAt: new Date() })
    .where(eq(tripComponents.id, component.id))
    .returning()) as TripComponent[]

  if (!updated) {
    throw new Error(`holdNonCatalogComponent: update returned no row for ${component.id}`)
  }

  await createComponentEvent(db, {
    envelopeId: updated.envelopeId,
    componentId: updated.id,
    eventType: statusToEventType(updated.status),
    fromStatus: component.status,
    toStatus: updated.status,
    payload: { reason: "internal_hold" },
  })

  return updated
}

async function applyReserveResultToComponent(
  db: AnyDrizzleDb,
  component: TripComponent,
  result: ReserveComponentResult,
): Promise<TripComponent> {
  assertTripComponentCanBeUpdated(component, { status: result.status })

  const [updated] = (await db
    .update(tripComponents)
    .set({
      ...reserveResultToComponentPatch(result),
      warningCodes: appendWarningCodes(component.warningCodes, result.warnings ?? []),
      updatedAt: new Date(),
    })
    .where(eq(tripComponents.id, component.id))
    .returning()) as TripComponent[]

  if (!updated) {
    throw new Error(`applyReserveResultToComponent: update returned no row for ${component.id}`)
  }

  await createComponentEvent(db, {
    envelopeId: updated.envelopeId,
    componentId: updated.id,
    eventType: statusToEventType(updated.status),
    fromStatus: component.status,
    toStatus: updated.status,
    payload: {
      bookingId: updated.bookingId,
      bookingGroupId: updated.bookingGroupId,
      orderId: updated.orderId,
      paymentSessionId: updated.paymentSessionId,
      providerRef: updated.providerRef,
      supplierRef: updated.supplierRef,
      holdExpiresAt: updated.holdExpiresAt?.toISOString(),
    },
  })

  return updated
}

async function applyReservationFailureToComponent(
  db: AnyDrizzleDb,
  component: TripComponent,
  reason: string,
): Promise<TripComponent> {
  if (!isAllowedTripComponentStatusTransition(component.status, "failed")) {
    return markComponentForStaffRemediation(db, component, reason)
  }

  const [updated] = (await db
    .update(tripComponents)
    .set({
      status: "failed",
      warningCodes: appendWarningCodes(component.warningCodes, [reason]),
      updatedAt: new Date(),
    })
    .where(eq(tripComponents.id, component.id))
    .returning()) as TripComponent[]

  if (!updated) {
    throw new Error(
      `applyReservationFailureToComponent: update returned no row for ${component.id}`,
    )
  }

  await createComponentEvent(db, {
    envelopeId: updated.envelopeId,
    componentId: updated.id,
    eventType: "failed",
    fromStatus: component.status,
    toStatus: updated.status,
    payload: { reason },
  })

  return updated
}

async function compensateReservedComponents(
  db: AnyDrizzleDb,
  reserved: Array<{ component: TripComponent; result: ReserveComponentResult }>,
  deps: ReserveTripDeps,
): Promise<ReserveTripResult["compensations"]> {
  const compensations: ReserveTripResult["compensations"] = []

  for (const item of [...reserved].reverse()) {
    if (!deps.releaseCatalogComponent) {
      await markComponentForStaffRemediation(db, item.component, "release_not_configured")
      compensations.push({
        componentId: item.component.id,
        status: "release_not_configured",
        reason: "release_not_configured",
      })
      continue
    }

    try {
      const released = await deps.releaseCatalogComponent({
        component: item.component,
        reserveResult: item.result,
      })
      compensations.push(await compensationFromRelease(db, item.component, released))
    } catch (error) {
      const reason = error instanceof Error ? error.message : "release_failed"
      await markComponentForStaffRemediation(db, item.component, reason)
      compensations.push({
        componentId: item.component.id,
        status: "release_failed",
        reason,
      })
    }
  }

  return compensations
}

async function compensationFromRelease(
  db: AnyDrizzleDb,
  component: TripComponent,
  released: ReleaseReservedComponentResult,
): Promise<ReserveTripResult["compensations"][number]> {
  if (!released.released) {
    const reason = released.reason ?? "release_failed"
    await markComponentForStaffRemediation(db, component, reason)
    return {
      componentId: component.id,
      status: "release_failed",
      reason,
    }
  }

  await markReservedComponentReleased(db, component)
  return { componentId: component.id, status: "released" }
}

async function markReservedComponentReleased(
  db: AnyDrizzleDb,
  component: TripComponent,
): Promise<TripComponent> {
  const [updated] = (await db
    .update(tripComponents)
    .set({
      status: "cancelled",
      warningCodes: appendWarningCodes(component.warningCodes, ["reservation_released"]),
      updatedAt: new Date(),
    })
    .where(eq(tripComponents.id, component.id))
    .returning()) as TripComponent[]

  if (!updated) {
    throw new Error(`markReservedComponentReleased: update returned no row for ${component.id}`)
  }

  await createComponentEvent(db, {
    envelopeId: updated.envelopeId,
    componentId: updated.id,
    eventType: "cancelled",
    fromStatus: component.status,
    toStatus: updated.status,
    payload: { reason: "reservation_released" },
  })

  return updated
}

function isReservedTripComponent(
  component: TripComponent,
): component is TripComponent & { status: "held" | "booked" } {
  return component.status === "held" || component.status === "booked"
}

function commonEnvelopeRefs(results: ReserveComponentResult[]): Partial<NewTripEnvelope> {
  const refs: Partial<NewTripEnvelope> = {}
  const bookingGroupId = commonString(results.map((result) => result.bookingGroupId))
  const orderId = commonString(results.map((result) => result.orderId))
  const paymentSessionId = commonString(results.map((result) => result.paymentSessionId))

  if (bookingGroupId) refs.bookingGroupId = bookingGroupId
  if (orderId) refs.orderId = orderId
  if (paymentSessionId) refs.paymentSessionId = paymentSessionId

  return refs
}
