import type { AnyDrizzleDb } from "@voyant-travel/db"
import { desc, eq } from "drizzle-orm"

import type {
  NewTripSnapshot,
  TripComponent,
  TripEnvelope,
  TripSnapshot,
  TripSnapshotProposal,
  TripSnapshotProposalLine,
} from "./schema.js"
import { tripSnapshots } from "./schema.js"
import { aggregateComponentPricing } from "./service-helpers.js"
import { getTrip } from "./service-trips.js"
import { TripsInvariantError } from "./service-types.js"
import type { CreateTripSnapshotInput } from "./validation.js"

export async function freezeTripSnapshot(
  db: AnyDrizzleDb,
  input: CreateTripSnapshotInput,
): Promise<TripSnapshot> {
  const trip = await getTrip(db, input.envelopeId)
  if (!trip) {
    throw new TripsInvariantError(`Trip envelope ${input.envelopeId} was not found`)
  }

  const components = trip.components.filter((component) => component.status !== "removed")
  const missingPricing = components.filter((component) => !component.pricingSnapshot)
  if (missingPricing.length > 0) {
    throw new TripsInvariantError(
      `Cannot freeze trip ${input.envelopeId}; components missing pricing snapshots: ${missingPricing
        .map((component) => component.id)
        .join(", ")}`,
    )
  }

  const frozenAt = new Date()
  const proposal = buildTripSnapshotProposal(trip.envelope, components, frozenAt)
  const values: NewTripSnapshot = {
    envelopeId: trip.envelope.id,
    sourceEnvelopeUpdatedAt: trip.envelope.updatedAt ?? frozenAt,
    titleSnapshot: trip.envelope.title,
    descriptionSnapshot: trip.envelope.description,
    travelerPartySnapshot: snapshotJsonRecord(trip.envelope.travelerParty),
    constraintsSnapshot: snapshotJsonRecord(trip.envelope.constraints),
    currency: proposal.currency,
    subtotalAmountCents: proposal.subtotalAmountCents,
    taxAmountCents: proposal.taxAmountCents,
    totalAmountCents: proposal.totalAmountCents,
    componentCount: proposal.componentCount,
    pricedComponentCount: proposal.pricedComponentCount,
    frozenEnvelope: snapshotJsonRecord(trip.envelope),
    frozenComponents: components.map(snapshotJsonRecord),
    proposal,
    createdBy: input.createdBy ?? null,
  }

  const [snapshot] = (await db.insert(tripSnapshots).values(values).returning()) as TripSnapshot[]
  if (!snapshot) throw new Error("freezeTripSnapshot: insert returned no snapshot")
  return snapshot
}

export async function getTripSnapshotById(
  db: AnyDrizzleDb,
  snapshotId: string,
): Promise<TripSnapshot | null> {
  const [snapshot] = (await db
    .select()
    .from(tripSnapshots)
    .where(eq(tripSnapshots.id, snapshotId))
    .limit(1)) as TripSnapshot[]
  return snapshot ?? null
}

export async function listTripSnapshots(
  db: AnyDrizzleDb,
  envelopeId: string,
): Promise<TripSnapshot[]> {
  return (await db
    .select()
    .from(tripSnapshots)
    .where(eq(tripSnapshots.envelopeId, envelopeId))
    .orderBy(desc(tripSnapshots.createdAt))) as TripSnapshot[]
}

export function buildTripSnapshotProposal(
  envelope: TripEnvelope,
  components: TripComponent[],
  frozenAt: Date,
): TripSnapshotProposal {
  const aggregate = aggregateComponentPricing(components, envelope.aggregateCurrency ?? undefined)
  return {
    envelopeId: envelope.id,
    title: envelope.title,
    description: envelope.description,
    currency: aggregate.currency,
    subtotalAmountCents: aggregate.subtotalAmountCents,
    taxAmountCents: aggregate.taxAmountCents,
    totalAmountCents: aggregate.totalAmountCents,
    componentCount: aggregate.componentCount,
    pricedComponentCount: aggregate.pricedComponentCount,
    warnings: aggregate.warnings ?? [],
    frozenAt: frozenAt.toISOString(),
    lines: components.map(componentToProposalLine),
  }
}

function componentToProposalLine(component: TripComponent): TripSnapshotProposalLine {
  const pricing = component.pricingSnapshot
  if (!pricing) {
    throw new TripsInvariantError(
      `Cannot build proposal line for unpriced component ${component.id}`,
    )
  }

  return {
    componentId: component.id,
    sequence: component.sequence,
    kind: component.kind,
    status: component.status,
    title: component.title,
    description: componentDisplayName(component),
    entityModule: component.entityModule,
    entityId: component.entityId,
    sourceKind: component.sourceKind,
    currency: pricing.currency,
    subtotalAmountCents: pricing.subtotalAmountCents,
    taxAmountCents: pricing.taxAmountCents,
    totalAmountCents: pricing.totalAmountCents,
    priceExpiresAt: pricing.priceExpiresAt ?? component.priceExpiresAt?.toISOString() ?? null,
    warnings: [...new Set([...(pricing.warnings ?? []), ...(component.warningCodes ?? [])])],
  }
}

function componentDisplayName(component: TripComponent): string {
  const metadata = component.metadata as {
    manualService?: { name?: unknown }
  }
  const manualServiceName = metadata.manualService?.name
  if (typeof component.title === "string" && component.title.trim()) return component.title
  if (typeof manualServiceName === "string" && manualServiceName.trim()) {
    return manualServiceName.trim()
  }
  if (typeof component.description === "string" && component.description.trim()) {
    return component.description
  }
  if (component.entityModule && component.entityId)
    return `${component.entityModule}:${component.entityId}`
  return component.kind.replaceAll("_", " ")
}

function snapshotJsonRecord(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}
