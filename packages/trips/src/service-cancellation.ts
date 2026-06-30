import type { AnyDrizzleDb } from "@voyant-travel/db"
import { eq } from "drizzle-orm"

import type { TripComponent, TripEnvelope } from "./schema.js"
import { tripComponents, tripEnvelopes } from "./schema.js"
import {
  aggregateComponentPricing,
  assertTripComponentCanBeUpdated,
  hasCommittedComponentReference,
} from "./service-helpers.js"
import {
  createComponentEvent,
  markComponentForStaffRemediation,
  minComponentPriceExpiry,
} from "./service-internals.js"
import { getTrip } from "./service-trips.js"
import type {
  CancelComponentResult,
  CancelTripComponentsDeps,
  CancelTripComponentsResult,
  ComponentCancellationPreview,
  PreviewTripCancellationDeps,
  Trip,
  TripCancellationPreviewResult,
} from "./service-types.js"
import { TripsInvariantError } from "./service-types.js"
import {
  type CancelTripComponentsInput,
  isTerminalTripComponentStatus,
  type PreviewTripCancellationInput,
} from "./validation.js"

export async function previewCancellation(
  db: AnyDrizzleDb,
  input: PreviewTripCancellationInput,
  deps: PreviewTripCancellationDeps = {},
): Promise<TripCancellationPreviewResult> {
  const trip = await getTrip(db, input.envelopeId)
  if (!trip) {
    throw new TripsInvariantError(`Trip envelope ${input.envelopeId} was not found`)
  }

  const requestedAt = input.requestedAt ? new Date(input.requestedAt) : new Date()
  const selected = selectComponentsForCancellation(trip, input.componentIds)
  const componentPreviews: ComponentCancellationPreview[] = []

  for (const component of selected) {
    componentPreviews.push(
      await previewComponentCancellation(trip.envelope, component, input, requestedAt, deps),
    )
  }

  return {
    envelope: trip.envelope,
    components: trip.components,
    preview: buildCancellationPreviewAggregate(trip.envelope, selected, componentPreviews),
  }
}

export async function cancelComponents(
  db: AnyDrizzleDb,
  input: CancelTripComponentsInput,
  deps: CancelTripComponentsDeps = {},
): Promise<CancelTripComponentsResult> {
  const preview = await previewCancellation(db, input, deps)
  const requestedAt = input.requestedAt ? new Date(input.requestedAt) : new Date()
  const componentsById = new Map(preview.components.map((component) => [component.id, component]))
  const cancelled: CancelTripComponentsResult["cancelled"] = []
  const remediation: CancelTripComponentsResult["remediation"] = []
  const skipped: CancelTripComponentsResult["skipped"] = []

  for (const item of preview.preview.components) {
    const component = componentsById.get(item.componentId)
    if (!component) continue

    if (item.action === "no_op") {
      skipped.push({ componentId: item.componentId, reason: item.reason ?? "no_action" })
      continue
    }

    if (item.action === "staff_remediation") {
      const reason = item.reason ?? "staff_remediation_required"
      const updated = await markComponentForStaffRemediation(db, component, reason)
      componentsById.set(updated.id, updated)
      remediation.push({ componentId: item.componentId, reason })
      continue
    }

    if (!deps.cancelComponent && !canCancelComponentLocally(component)) {
      const reason = "cancel_adapter_not_configured"
      const updated = await markComponentForStaffRemediation(db, component, reason)
      componentsById.set(updated.id, updated)
      remediation.push({ componentId: item.componentId, reason })
      continue
    }

    try {
      const result = canCancelComponentLocally(component)
        ? localCancellationResult(item)
        : await deps.cancelComponent?.({
            envelope: preview.envelope,
            component,
            preview: item,
            reason: input.reason,
            requestedAt,
            request: input.request,
          })

      if (result?.status !== "cancelled") {
        const reason = result?.reason ?? `cancel_${result?.status ?? "not_configured"}`
        const updated = await markComponentForStaffRemediation(db, component, reason)
        componentsById.set(updated.id, updated)
        remediation.push({ componentId: item.componentId, reason })
        continue
      }

      const updated = await markComponentCancelled(db, component, {
        ...item,
        refundAmountCents: result.refundAmountCents ?? item.refundAmountCents,
        refundCurrency: result.refundCurrency ?? item.refundCurrency,
        snapshot: result.snapshot ?? item.snapshot,
      })
      componentsById.set(updated.id, updated)
      cancelled.push({ componentId: item.componentId, status: "cancelled" })
    } catch (error) {
      const reason = error instanceof Error ? error.message : "cancel_failed"
      const updated = await markComponentForStaffRemediation(db, component, reason)
      componentsById.set(updated.id, updated)
      remediation.push({ componentId: item.componentId, reason })
    }
  }

  const refreshed = await getTrip(db, input.envelopeId)
  const components = refreshed?.components ?? [...componentsById.values()]
  const refreshedEnvelope = await refreshEnvelopePricingAfterCancellation(
    db,
    refreshed?.envelope ?? preview.envelope,
    components,
  )
  const envelope = await maybeCancelEnvelope(db, refreshedEnvelope, components)
  const finalTrip =
    envelope === refreshedEnvelope && refreshed
      ? { envelope, components: refreshed.components }
      : await getTrip(db, input.envelopeId)

  return {
    envelope,
    components: finalTrip?.components ?? components,
    preview: {
      ...preview.preview,
      staffActionRequired: preview.preview.staffActionRequired || remediation.length > 0,
    },
    cancelled,
    remediation,
    skipped,
  }
}

function selectComponentsForCancellation(trip: Trip, componentIds?: string[]): TripComponent[] {
  if (!componentIds || componentIds.length === 0) {
    return trip.components.filter((component) => !isTerminalTripComponentStatus(component.status))
  }

  const componentsById = new Map(trip.components.map((component) => [component.id, component]))
  const selected: TripComponent[] = []
  for (const componentId of componentIds) {
    const component = componentsById.get(componentId)
    if (!component) {
      throw new TripsInvariantError(
        `Trip component ${componentId} was not found on envelope ${trip.envelope.id}`,
      )
    }
    selected.push(component)
  }
  return selected
}

async function previewComponentCancellation(
  envelope: TripEnvelope,
  component: TripComponent,
  input: PreviewTripCancellationInput,
  requestedAt: Date,
  deps: PreviewTripCancellationDeps,
): Promise<ComponentCancellationPreview> {
  if (isTerminalTripComponentStatus(component.status)) {
    return componentCancellationPreview(component, {
      action: "no_op",
      staffActionRequired: false,
      reason: `already_${component.status}`,
    })
  }

  if (canCancelComponentLocally(component)) {
    return componentCancellationPreview(component, {
      action: "cancel",
      staffActionRequired: false,
      reason: "local_component_cancel",
    })
  }

  if (deps.previewComponentCancellation) {
    return deps.previewComponentCancellation({
      envelope,
      component,
      reason: input.reason,
      requestedAt,
      request: input.request,
    })
  }

  return componentCancellationPreview(component, {
    action: "staff_remediation",
    staffActionRequired: true,
    reason: "cancel_preview_not_configured",
  })
}

function canCancelComponentLocally(component: TripComponent): boolean {
  if (component.kind === "manual_placeholder") {
    return true
  }

  if (component.kind === "flight_placeholder" && !hasCommittedComponentReference(component)) {
    return true
  }

  return (
    component.kind === "catalog_booking" &&
    !hasCommittedComponentReference(component) &&
    (component.status === "draft" ||
      component.status === "priced" ||
      component.status === "unavailable" ||
      component.status === "failed")
  )
}

function componentCancellationPreview(
  component: TripComponent,
  overrides: Omit<ComponentCancellationPreview, "componentId" | "currentStatus">,
): ComponentCancellationPreview {
  return {
    componentId: component.id,
    currentStatus: component.status,
    refundAmountCents: 0,
    refundCurrency: component.componentCurrency ?? undefined,
    penaltyAmountCents: 0,
    ...overrides,
  }
}

function buildCancellationPreviewAggregate(
  envelope: TripEnvelope,
  selected: TripComponent[],
  componentPreviews: ComponentCancellationPreview[],
): TripCancellationPreviewResult["preview"] {
  const warnings = new Set<string>()
  let currency = envelope.aggregateCurrency ?? null
  let estimatedRefundAmountCents = 0
  let estimatedPenaltyAmountCents = 0

  for (const item of componentPreviews) {
    if (item.refundCurrency) {
      currency ??= item.refundCurrency
      if (currency !== item.refundCurrency) {
        warnings.add(`refund_currency_mismatch:${item.refundCurrency}`)
      }
    }
    if (!item.refundCurrency || !currency || item.refundCurrency === currency) {
      estimatedRefundAmountCents += item.refundAmountCents ?? 0
    }
    estimatedPenaltyAmountCents += item.penaltyAmountCents ?? 0
    if (item.reason && item.action !== "cancel") warnings.add(item.reason)
  }

  return {
    envelopeId: envelope.id,
    selectedComponentIds: selected.map((component) => component.id),
    currency,
    estimatedRefundAmountCents,
    estimatedPenaltyAmountCents,
    staffActionRequired: componentPreviews.some((item) => item.staffActionRequired),
    components: componentPreviews,
    warnings: [...warnings],
  }
}

function localCancellationResult(preview: ComponentCancellationPreview): CancelComponentResult {
  return {
    status: "cancelled",
    refundAmountCents: preview.refundAmountCents,
    refundCurrency: preview.refundCurrency,
    snapshot: preview.snapshot,
  }
}

async function markComponentCancelled(
  db: AnyDrizzleDb,
  component: TripComponent,
  preview: ComponentCancellationPreview,
): Promise<TripComponent> {
  assertTripComponentCanBeUpdated(component, { status: "cancelled" })

  const cancellationSnapshot = {
    action: preview.action,
    refundAmountCents: preview.refundAmountCents ?? 0,
    refundCurrency: preview.refundCurrency ?? component.componentCurrency ?? null,
    penaltyAmountCents: preview.penaltyAmountCents ?? 0,
    supplierCancellationDeadline: preview.supplierCancellationDeadline ?? null,
    policySummary: preview.policySummary ?? null,
    snapshot: preview.snapshot ?? null,
  }

  const [updated] = (await db
    .update(tripComponents)
    .set({
      status: "cancelled",
      cancellationSnapshot,
      updatedAt: new Date(),
    })
    .where(eq(tripComponents.id, component.id))
    .returning()) as TripComponent[]

  if (!updated) {
    throw new Error(`markComponentCancelled: update returned no row for ${component.id}`)
  }

  await createComponentEvent(db, {
    envelopeId: updated.envelopeId,
    componentId: updated.id,
    eventType: "cancelled",
    fromStatus: component.status,
    toStatus: updated.status,
    payload: cancellationSnapshot,
  })

  return updated
}

async function maybeCancelEnvelope(
  db: AnyDrizzleDb,
  envelope: TripEnvelope,
  components: TripComponent[],
): Promise<TripEnvelope> {
  const hasActiveComponent = components.some(
    (component) => component.status !== "cancelled" && component.status !== "removed",
  )
  if (hasActiveComponent || envelope.status === "cancelled") return envelope

  const [updated] = (await db
    .update(tripEnvelopes)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(tripEnvelopes.id, envelope.id))
    .returning()) as TripEnvelope[]

  return updated ?? envelope
}

async function refreshEnvelopePricingAfterCancellation(
  db: AnyDrizzleDb,
  envelope: TripEnvelope,
  components: TripComponent[],
): Promise<TripEnvelope> {
  const pricing = aggregateComponentPricing(components, envelope.aggregateCurrency ?? undefined)
  const activeComponents = components.filter(
    (component) => component.status !== "cancelled" && component.status !== "removed",
  )

  const [updated] = (await db
    .update(tripEnvelopes)
    .set({
      aggregateCurrency: pricing.currency,
      aggregateSubtotalAmountCents: pricing.subtotalAmountCents,
      aggregateTaxAmountCents: pricing.taxAmountCents,
      aggregateTotalAmountCents: pricing.totalAmountCents,
      aggregatePricingSnapshot: pricing,
      currentPriceExpiresAt: minComponentPriceExpiry(activeComponents),
      updatedAt: new Date(),
    })
    .where(eq(tripEnvelopes.id, envelope.id))
    .returning()) as TripEnvelope[]

  return updated ?? envelope
}
