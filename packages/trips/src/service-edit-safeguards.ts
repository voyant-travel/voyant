import type { TripComponent, TripEnvelope } from "./schema.js"
import { hasCommittedComponentReference } from "./service-helpers.js"
import { type Trip, TripsInvariantError } from "./service-types.js"
import type { UpdateTripComponentInput, UpdateTripEnvelopeInput } from "./validation.js"

export function assertTripEnvelopeCanMutateComponents(
  envelope: Pick<TripEnvelope, "id" | "status" | "checkoutStartedAt">,
): void {
  if (!tripEnvelopeBlocksComponentMutations(envelope)) return

  const state = tripEnvelopeStatusBlocksComponentMutations(envelope.status)
    ? `is ${envelope.status}`
    : "has checkout started"

  throw new TripsInvariantError(
    `Trip ${envelope.id} ${state} and cannot mutate components after checkout has started`,
  )
}

export function updatesSupplierCommitmentEnvelopeFields(input: UpdateTripEnvelopeInput): boolean {
  return input.travelerParty !== undefined || input.constraints !== undefined
}

export function assertTripSupplierCommitmentsCanReceiveEnvelopePatch(trip: Trip): void {
  if (!tripEnvelopeHasCommittedSupplierBackedComponents(trip)) return

  throw new TripsInvariantError(
    `Trip ${trip.envelope.id} has committed supplier-backed components and requires a structured amendment before traveler, billing, or commitment data can change`,
  )
}

export function assertTripSupplierCommitmentCanReceiveComponentPatch(
  component: TripComponent,
  input: UpdateTripComponentInput,
): void {
  if (!updatesSupplierCommitmentComponentFields(input)) return
  if (!isCommittedSupplierBackedComponent(component)) return

  throw new TripsInvariantError(
    `Trip component ${component.id} is committed to a supplier and requires a structured amendment before commitment data can change`,
  )
}

function updatesSupplierCommitmentComponentFields(input: UpdateTripComponentInput): boolean {
  return (
    input.description !== undefined ||
    input.metadata !== undefined ||
    input.catalogRef !== undefined
  )
}

function tripEnvelopeHasCommittedSupplierBackedComponents(trip: Trip): boolean {
  if (!isCommittedEnvelopeStatus(trip.envelope.status)) return false
  return trip.components.some(isCommittedSupplierBackedComponent)
}

function isCommittedEnvelopeStatus(status: TripEnvelope["status"]): boolean {
  return status === "reserved" || status === "checkout_started" || status === "booked"
}

function tripEnvelopeBlocksComponentMutations(
  envelope: Pick<TripEnvelope, "status" | "checkoutStartedAt">,
): boolean {
  return (
    envelope.checkoutStartedAt !== null ||
    tripEnvelopeStatusBlocksComponentMutations(envelope.status)
  )
}

function tripEnvelopeStatusBlocksComponentMutations(status: TripEnvelope["status"]): boolean {
  return status === "checkout_started" || status === "booked"
}

function isCommittedSupplierBackedComponent(component: TripComponent): boolean {
  if (!isCommittedComponentStatus(component.status)) return false
  if (!hasCommittedComponentReference(component)) return false

  return Boolean(
    component.supplierRef ||
      component.providerRef ||
      component.orderId ||
      component.kind === "flight_placeholder" ||
      component.kind === "flight_order" ||
      component.kind === "external_order" ||
      (component.sourceKind && component.sourceKind !== "owned"),
  )
}

function isCommittedComponentStatus(status: TripComponent["status"]): boolean {
  return status === "held" || status === "booked" || status === "checkout_started"
}
