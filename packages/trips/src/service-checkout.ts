import type { AnyDrizzleDb } from "@voyant-travel/db"
import { eq } from "drizzle-orm"

import type { NewTripEnvelope, TripComponent } from "./schema.js"
import { tripComponents, tripEnvelopes } from "./schema.js"
import {
  aggregateComponentPricing,
  assertTripComponentCanBeUpdated,
  assertTripComponentCanStartCheckout,
  checkoutResultToComponentPatch,
  shouldReplayCheckout,
} from "./service-helpers.js"
import {
  appendWarningCodes,
  commonString,
  createComponentEvent,
  markComponentForStaffRemediation,
  minComponentHoldExpiry,
  statusToEventType,
} from "./service-internals.js"
import { getTrip } from "./service-trips.js"
import type {
  CompleteTripCheckoutInput,
  CompleteTripCheckoutResult,
  ComponentCheckoutResult,
  StartCheckoutDeps,
  StartCheckoutResult,
  StartCheckoutTarget,
  StartedTripComponentCheckout,
  Trip,
  TripCheckoutResult,
} from "./service-types.js"
import { TripsInvariantError } from "./service-types.js"
import { assertTripTravelerPartyComplete } from "./traveler-party-validation.js"
import type { StartTripCheckoutInput } from "./validation.js"

const payableEnvelopeStatuses = new Set(["reserved", "checkout_started", "booked"])
const payableComponentStatuses = new Set(["held", "checkout_started", "booked"])

export async function startCheckout(
  db: AnyDrizzleDb,
  input: StartTripCheckoutInput,
  deps: StartCheckoutDeps,
): Promise<StartCheckoutResult> {
  const trip = await getTrip(db, input.envelopeId)
  if (!trip) {
    throw new TripsInvariantError(`Trip envelope ${input.envelopeId} was not found`)
  }

  if (shouldReplayCheckout(trip.envelope, input.idempotencyKey)) {
    return replayCheckoutResult(trip)
  }

  if (trip.envelope.status !== "reserved") {
    throw new TripsInvariantError(
      `Trip envelope ${input.envelopeId} is ${trip.envelope.status} and must be reserved before checkout`,
    )
  }

  assertTripTravelerPartyComplete(trip.envelope.travelerParty, "Trip checkout")

  const warnings = new Set<string>()
  const failures: StartCheckoutResult["failures"] = []
  const componentCheckouts: StartedTripComponentCheckout[] = []
  const componentsById = new Map(trip.components.map((component) => [component.id, component]))
  const checkoutable = trip.components.filter(
    (component) => component.status !== "removed" && component.status !== "cancelled",
  )

  if (deps.startTripCheckout) {
    const result = await deps.startTripCheckout({
      trip,
      intent: input.intent,
      request: input.request,
    })
    for (const warning of result.warnings ?? []) warnings.add(warning)
    const [envelope] = (await db
      .update(tripEnvelopes)
      .set({
        status: result.status ?? "checkout_started",
        checkoutIdempotencyKey: input.idempotencyKey ?? null,
        checkoutStartedAt: new Date(),
        paymentSessionId: result.paymentSessionId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(tripEnvelopes.id, input.envelopeId))
      .returning()) as Trip["envelope"][]

    if (!envelope) {
      throw new Error("startCheckout: aggregate envelope update returned no rows")
    }

    const refreshed = await getTrip(db, input.envelopeId)
    const components = refreshed?.components ?? trip.components
    const componentCheckouts = aggregateComponentCheckouts(components, result)
    return {
      envelope,
      components,
      target: checkoutTargetFromTrip(envelope, components, componentCheckouts),
      componentCheckouts,
      failures: [],
      warnings: [...warnings],
    }
  }

  for (const component of checkoutable) {
    try {
      assertTripComponentCanStartCheckout(component)
      const result = await deps.startComponentCheckout({
        envelope: trip.envelope,
        component,
        intent: input.intent,
        request: input.request,
      })
      const updated = await applyCheckoutResultToComponent(db, component, result)
      componentsById.set(updated.id, updated)
      componentCheckouts.push(toStartedComponentCheckout(updated, result))
      for (const warning of result.warnings ?? []) warnings.add(warning)
    } catch (error) {
      const reason = error instanceof Error ? error.message : "checkout_start_failed"
      warnings.add(reason)
      failures.push({ componentId: component.id, reason })
      const updated = await markComponentForStaffRemediation(db, component, reason)
      componentsById.set(updated.id, updated)
    }
  }

  if (failures.length > 0) {
    const [failedEnvelope] = (await db
      .update(tripEnvelopes)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(tripEnvelopes.id, input.envelopeId))
      .returning()) as Trip["envelope"][]

    if (!failedEnvelope) {
      throw new Error("startCheckout: failed envelope update returned no rows")
    }

    const refreshed = await getTrip(db, input.envelopeId)
    const components = refreshed?.components ?? [...componentsById.values()]
    return {
      envelope: failedEnvelope,
      components,
      target: checkoutTargetFromTrip(failedEnvelope, components, componentCheckouts),
      componentCheckouts,
      failures,
      warnings: [...warnings],
    }
  }

  const refs = commonEnvelopeCheckoutRefs(componentCheckouts)
  const [envelope] = (await db
    .update(tripEnvelopes)
    .set({
      status: "checkout_started",
      checkoutIdempotencyKey: input.idempotencyKey ?? null,
      checkoutStartedAt: new Date(),
      ...refs,
      updatedAt: new Date(),
    })
    .where(eq(tripEnvelopes.id, input.envelopeId))
    .returning()) as Trip["envelope"][]

  if (!envelope) {
    throw new Error("startCheckout: envelope update returned no rows")
  }

  const refreshed = await getTrip(db, input.envelopeId)
  const components = refreshed?.components ?? [...componentsById.values()]
  return {
    envelope,
    components,
    target: checkoutTargetFromTrip(envelope, components, componentCheckouts),
    componentCheckouts,
    failures,
    warnings: [...warnings],
  }
}

export async function completeTripCheckout(
  db: AnyDrizzleDb,
  input: CompleteTripCheckoutInput,
): Promise<CompleteTripCheckoutResult | null> {
  if (!input.envelopeId && !input.paymentSessionId) {
    throw new TripsInvariantError("completeTripCheckout requires an envelopeId or paymentSessionId")
  }

  const trip = await findTripForCheckoutCompletion(db, input)
  if (!trip) return null

  if (!payableEnvelopeStatuses.has(trip.envelope.status)) {
    throw new TripsInvariantError(
      `Trip envelope ${trip.envelope.id} is ${trip.envelope.status} and cannot be completed from payment`,
    )
  }

  const paymentSessionId = input.paymentSessionId ?? trip.envelope.paymentSessionId ?? null
  if (
    input.paymentSessionId &&
    trip.envelope.paymentSessionId &&
    trip.envelope.paymentSessionId !== input.paymentSessionId
  ) {
    throw new TripsInvariantError(
      `Payment session ${input.paymentSessionId} does not belong to trip envelope ${trip.envelope.id}`,
    )
  }

  const alreadyCompleted =
    trip.envelope.status === "booked" &&
    trip.components
      .filter((component) => component.status !== "removed" && component.status !== "cancelled")
      .every((component) => component.status === "booked")

  if (alreadyCompleted) {
    return {
      envelope: trip.envelope,
      components: trip.components,
      updatedComponentIds: [],
      alreadyCompleted: true,
    }
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date()
  const updatedComponentIds: string[] = []
  for (const component of trip.components) {
    if (component.status === "removed" || component.status === "cancelled") continue
    if (!payableComponentStatuses.has(component.status)) {
      throw new TripsInvariantError(
        `Trip component ${component.id} is ${component.status} and cannot be completed from payment`,
      )
    }
    if (component.status === "booked") continue

    const [updated] = (await db
      .update(tripComponents)
      .set({ status: "booked", updatedAt: paidAt })
      .where(eq(tripComponents.id, component.id))
      .returning()) as TripComponent[]

    if (!updated) {
      throw new Error(`completeTripCheckout: update returned no row for ${component.id}`)
    }

    updatedComponentIds.push(updated.id)
    await createComponentEvent(db, {
      envelopeId: updated.envelopeId,
      componentId: updated.id,
      eventType: "booked",
      fromStatus: component.status,
      toStatus: "booked",
      actorId: input.actorId ?? null,
      payload: {
        paymentSessionId,
        paidAt: paidAt.toISOString(),
        ...(input.payload ?? {}),
      },
    })
  }

  const [envelope] = (await db
    .update(tripEnvelopes)
    .set({
      status: "booked",
      paymentSessionId: paymentSessionId ?? trip.envelope.paymentSessionId ?? null,
      updatedAt: paidAt,
    })
    .where(eq(tripEnvelopes.id, trip.envelope.id))
    .returning()) as Trip["envelope"][]

  if (!envelope) {
    throw new Error(`completeTripCheckout: envelope update returned no row for ${trip.envelope.id}`)
  }

  const refreshed = await getTrip(db, envelope.id)
  return {
    envelope,
    components: refreshed?.components ?? trip.components,
    updatedComponentIds,
    alreadyCompleted: false,
  }
}

async function findTripForCheckoutCompletion(
  db: AnyDrizzleDb,
  input: CompleteTripCheckoutInput,
): Promise<Trip | null> {
  if (input.envelopeId) {
    return getTrip(db, input.envelopeId)
  }

  const [envelope] = (await db
    .select()
    .from(tripEnvelopes)
    .where(eq(tripEnvelopes.paymentSessionId, input.paymentSessionId as string))
    .limit(1)) as Trip["envelope"][]

  if (!envelope) return null
  return getTrip(db, envelope.id)
}

function aggregateComponentCheckouts(
  components: TripComponent[],
  result: TripCheckoutResult,
): StartedTripComponentCheckout[] {
  return components
    .filter((component) => component.status !== "removed" && component.status !== "cancelled")
    .map((component) => ({
      componentId: component.id,
      kind: result.kind,
      bookingId: component.bookingId,
      orderId: component.orderId,
      paymentSessionId: result.paymentSessionId ?? null,
      checkoutUrl: result.checkoutUrl ?? null,
      bankTransferInstructions: result.bankTransferInstructions ?? null,
      expiresAt: result.expiresAt ?? component.holdExpiresAt?.toISOString() ?? null,
    }))
}

async function applyCheckoutResultToComponent(
  db: AnyDrizzleDb,
  component: TripComponent,
  result: ComponentCheckoutResult,
): Promise<TripComponent> {
  const nextStatus = result.status ?? "checkout_started"
  assertTripComponentCanBeUpdated(component, { status: nextStatus })

  const [updated] = (await db
    .update(tripComponents)
    .set({
      ...checkoutResultToComponentPatch(result),
      warningCodes: appendWarningCodes(component.warningCodes, result.warnings ?? []),
      updatedAt: new Date(),
    })
    .where(eq(tripComponents.id, component.id))
    .returning()) as TripComponent[]

  if (!updated) {
    throw new Error(`applyCheckoutResultToComponent: update returned no row for ${component.id}`)
  }

  await createComponentEvent(db, {
    envelopeId: updated.envelopeId,
    componentId: updated.id,
    eventType: statusToEventType(updated.status),
    fromStatus: component.status,
    toStatus: updated.status,
    payload: {
      kind: result.kind,
      bookingId: updated.bookingId,
      bookingGroupId: updated.bookingGroupId,
      orderId: updated.orderId,
      paymentSessionId: updated.paymentSessionId,
      providerRef: updated.providerRef,
      supplierRef: updated.supplierRef,
      checkoutUrl: result.checkoutUrl,
      externalReference: result.externalReference,
    },
  })

  return updated
}

function replayCheckoutResult(trip: Trip): StartCheckoutResult {
  const components = trip.components
  const componentCheckouts = components
    .filter((component) => component.status === "checkout_started" || component.status === "booked")
    .map((component) =>
      toStartedComponentCheckout(component, {
        kind: component.paymentSessionId ? "payment_session" : "hold_placed",
        status: component.status === "booked" ? "booked" : "checkout_started",
        paymentSessionId: component.paymentSessionId ?? undefined,
      }),
    )

  return {
    envelope: trip.envelope,
    components,
    target: checkoutTargetFromTrip(trip.envelope, components, componentCheckouts),
    componentCheckouts,
    failures: [],
    warnings: ["idempotent_replay"],
  }
}

function toStartedComponentCheckout(
  component: TripComponent,
  result: ComponentCheckoutResult,
): StartedTripComponentCheckout {
  return {
    componentId: component.id,
    kind: result.kind,
    bookingId: component.bookingId,
    orderId: component.orderId,
    paymentSessionId: component.paymentSessionId,
    checkoutUrl: result.checkoutUrl ?? null,
    bankTransferInstructions: result.bankTransferInstructions ?? null,
    expiresAt: result.expiresAt ?? component.holdExpiresAt?.toISOString() ?? null,
  }
}

function checkoutTargetFromTrip(
  envelope: Trip["envelope"],
  components: TripComponent[],
  componentCheckouts: StartedTripComponentCheckout[],
): StartCheckoutTarget {
  return {
    envelopeId: envelope.id,
    status: "checkout_started",
    currency: envelope.aggregateCurrency ?? aggregateComponentPricing(components).currency,
    totalAmountCents:
      envelope.aggregateTotalAmountCents ?? aggregateComponentPricing(components).totalAmountCents,
    paymentSessionId:
      envelope.paymentSessionId ??
      commonString(componentCheckouts.map((checkout) => checkout.paymentSessionId ?? undefined)) ??
      null,
    checkoutUrl:
      commonString(componentCheckouts.map((checkout) => checkout.checkoutUrl ?? undefined)) ?? null,
    holdExpiresAt: minComponentHoldExpiry(components)?.toISOString() ?? null,
  }
}

function commonEnvelopeCheckoutRefs(
  componentCheckouts: StartedTripComponentCheckout[],
): Partial<NewTripEnvelope> {
  const refs: Partial<NewTripEnvelope> = {}
  const paymentSessionId = commonString(
    componentCheckouts.map((checkout) => checkout.paymentSessionId ?? undefined),
  )
  const orderId = commonString(componentCheckouts.map((checkout) => checkout.orderId ?? undefined))

  if (paymentSessionId) refs.paymentSessionId = paymentSessionId
  if (orderId) refs.orderId = orderId

  return refs
}
