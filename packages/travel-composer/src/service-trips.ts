import type { AnyDrizzleDb } from "@voyantjs/db"
import { asc, eq, inArray } from "drizzle-orm"

import type { NewTripComponent, NewTripEnvelope, TripComponent, TripEnvelope } from "./schema.js"
import { tripComponents, tripEnvelopes } from "./schema.js"
import {
  assertTripComponentCanBeUpdated,
  assertTripComponentCanReceiveRefs,
} from "./service-helpers.js"
import { createComponentEvent, statusToEventType } from "./service-internals.js"
import { TravelComposerInvariantError, type Trip, type TripListResult } from "./service-types.js"
import { assertTripTravelerPartyComplete } from "./traveler-party-validation.js"
import type {
  CreateTripComponentInput,
  CreateTripEnvelopeInput,
  ListTripsQuery,
  ReorderTripComponentsInput,
  UpdateTripComponentInput,
  UpdateTripComponentRefsInput,
  UpdateTripEnvelopeInput,
} from "./validation.js"

export async function createTrip(db: AnyDrizzleDb, input: CreateTripEnvelopeInput): Promise<Trip> {
  assertTripTravelerPartyComplete(input.travelerParty, "Trip creation")

  const values: NewTripEnvelope = {
    title: input.title,
    description: input.description,
    travelerParty: input.travelerParty,
    constraints: input.constraints,
    createdBy: input.createdBy,
    updatedBy: input.createdBy,
  }

  const [envelope] = (await db.insert(tripEnvelopes).values(values).returning()) as TripEnvelope[]
  if (!envelope) throw new Error("createTrip: insert returned no envelope")

  return { envelope, components: [] }
}

export async function getTrip(db: AnyDrizzleDb, envelopeId: string): Promise<Trip | null> {
  const [envelope] = (await db
    .select()
    .from(tripEnvelopes)
    .where(eq(tripEnvelopes.id, envelopeId))
    .limit(1)) as TripEnvelope[]
  if (!envelope) return null

  const components = (await db
    .select()
    .from(tripComponents)
    .where(eq(tripComponents.envelopeId, envelopeId))
    .orderBy(asc(tripComponents.sequence), asc(tripComponents.createdAt))) as TripComponent[]

  return { envelope, components }
}

export async function listTrips(
  db: AnyDrizzleDb,
  input: ListTripsQuery = {
    limit: 50,
    offset: 0,
    sortBy: "updatedAt",
    sortDir: "desc",
  },
): Promise<TripListResult> {
  const allEnvelopes = (await db.select().from(tripEnvelopes)) as TripEnvelope[]

  const needsComponents =
    input.productId !== undefined ||
    input.hospitalityId !== undefined ||
    input.cruiseId !== undefined ||
    input.hasFlight === true
  // When a component-based filter is active we have to know each envelope's
  // components *before* paging, so fetch them up front. Otherwise we keep the
  // cheap path that only loads components for the visible page.
  const allComponents = needsComponents
    ? ((await db
        .select()
        .from(tripComponents)
        .orderBy(asc(tripComponents.sequence), asc(tripComponents.createdAt))) as TripComponent[])
    : []
  const allComponentsByEnvelope = new Map<string, TripComponent[]>()
  if (needsComponents) {
    for (const component of allComponents) {
      if (component.status === "removed") continue
      const bucket = allComponentsByEnvelope.get(component.envelopeId) ?? []
      bucket.push(component)
      allComponentsByEnvelope.set(component.envelopeId, bucket)
    }
  }

  const normalizedSearch = input.search?.toLowerCase()
  const createdFromMs = parseDateMs(input.createdFrom)
  const createdToMs = parseEndDateMs(input.createdTo)
  const filtered = allEnvelopes.filter((envelope) => {
    if (input.status && envelope.status !== input.status) return false
    if (normalizedSearch) {
      const matches = [envelope.id, envelope.title, envelope.description]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(normalizedSearch))
      if (!matches) return false
    }
    if (input.totalMinCents !== undefined) {
      const total = envelope.aggregateTotalAmountCents ?? null
      if (total === null || total < input.totalMinCents) return false
    }
    if (input.totalMaxCents !== undefined) {
      const total = envelope.aggregateTotalAmountCents ?? null
      if (total === null || total > input.totalMaxCents) return false
    }
    if (createdFromMs !== null) {
      const ts = envelope.createdAt?.getTime() ?? null
      if (ts === null || ts < createdFromMs) return false
    }
    if (createdToMs !== null) {
      const ts = envelope.createdAt?.getTime() ?? null
      if (ts === null || ts > createdToMs) return false
    }
    if (needsComponents) {
      const envelopeComponents = allComponentsByEnvelope.get(envelope.id) ?? []
      if (
        input.productId &&
        !envelopeComponents.some(
          (component) =>
            component.entityModule === "products" && component.entityId === input.productId,
        )
      ) {
        return false
      }
      if (
        input.hospitalityId &&
        !envelopeComponents.some(
          (component) =>
            component.entityModule === "hospitality" && component.entityId === input.hospitalityId,
        )
      ) {
        return false
      }
      if (
        input.cruiseId &&
        !envelopeComponents.some(
          (component) =>
            component.entityModule === "cruises" && component.entityId === input.cruiseId,
        )
      ) {
        return false
      }
      if (
        input.hasFlight === true &&
        !envelopeComponents.some(
          (component) =>
            component.kind === "flight_placeholder" || component.kind === "flight_order",
        )
      ) {
        return false
      }
    }
    return true
  })

  const sortDirection = input.sortDir === "asc" ? 1 : -1
  filtered.sort((a, b) => {
    const compare = compareEnvelopes(a, b, input.sortBy)
    if (compare !== 0) return compare * sortDirection
    const updatedDelta = (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
    if (updatedDelta !== 0) return updatedDelta
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  })

  const page = filtered.slice(input.offset, input.offset + input.limit)
  const envelopeIds = page.map((envelope) => envelope.id)
  const components = needsComponents
    ? envelopeIds.flatMap((id) => allComponentsByEnvelope.get(id) ?? [])
    : envelopeIds.length > 0
      ? ((await db
          .select()
          .from(tripComponents)
          .where(inArray(tripComponents.envelopeId, envelopeIds))
          .orderBy(asc(tripComponents.sequence), asc(tripComponents.createdAt))) as TripComponent[])
      : []

  const componentsByEnvelope = new Map<string, TripComponent[]>()
  for (const component of components) {
    const bucket = componentsByEnvelope.get(component.envelopeId) ?? []
    bucket.push(component)
    componentsByEnvelope.set(component.envelopeId, bucket)
  }

  return {
    data: page.map((envelope) => ({
      envelope,
      components: componentsByEnvelope.get(envelope.id) ?? [],
    })),
    total: filtered.length,
    limit: input.limit,
    offset: input.offset,
  }
}

function parseDateMs(value: string | undefined): number | null {
  if (!value) return null
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : null
}

function parseEndDateMs(value: string | undefined): number | null {
  if (!value) return null
  // Date-only `YYYY-MM-DD` strings should match the whole day. Use the end
  // of that day in UTC so callers comparing `createdAt <= createdTo` get the
  // intuitive inclusive behaviour.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const ts = new Date(`${value}T23:59:59.999Z`).getTime()
    return Number.isFinite(ts) ? ts : null
  }
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : null
}

export async function updateTrip(
  db: AnyDrizzleDb,
  envelopeId: string,
  input: UpdateTripEnvelopeInput,
): Promise<TripEnvelope | null> {
  if (input.travelerParty !== undefined) {
    assertTripTravelerPartyComplete(input.travelerParty, "Trip update")
  }

  const updates: Partial<NewTripEnvelope> = {
    updatedAt: new Date(),
  }

  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) updates.description = input.description
  if (input.travelerParty !== undefined) updates.travelerParty = input.travelerParty
  if (input.constraints !== undefined) updates.constraints = input.constraints
  if (input.status !== undefined) updates.status = input.status
  if (input.updatedBy !== undefined) updates.updatedBy = input.updatedBy

  const [row] = (await db
    .update(tripEnvelopes)
    .set(updates)
    .where(eq(tripEnvelopes.id, envelopeId))
    .returning()) as TripEnvelope[]
  return row ?? null
}

export async function addComponent(
  db: AnyDrizzleDb,
  input: CreateTripComponentInput,
): Promise<TripComponent> {
  const values: NewTripComponent = {
    envelopeId: input.envelopeId,
    sequence: input.sequence,
    kind: input.kind,
    description: input.description,
    entityModule: input.catalogRef?.entityModule,
    entityId: input.catalogRef?.entityId,
    sourceKind: input.catalogRef?.sourceKind,
    sourceConnectionId: input.catalogRef?.sourceConnectionId,
    sourceRef: input.catalogRef?.sourceRef,
    componentCurrency: input.estimatedPricing?.currency,
    componentSubtotalAmountCents: input.estimatedPricing?.subtotalAmountCents,
    componentTaxAmountCents: input.estimatedPricing?.taxAmountCents,
    componentTotalAmountCents: input.estimatedPricing?.totalAmountCents,
    pricingSnapshot: input.estimatedPricing,
    metadata: input.metadata,
  }

  const [component] = (await db
    .insert(tripComponents)
    .values(values)
    .returning()) as TripComponent[]
  if (!component) throw new Error("addComponent: insert returned no component")

  await createComponentEvent(db, {
    envelopeId: component.envelopeId,
    componentId: component.id,
    eventType: "created",
    toStatus: component.status,
    payload: {},
  })

  return component
}

export async function updateComponent(
  db: AnyDrizzleDb,
  componentId: string,
  input: UpdateTripComponentInput,
): Promise<TripComponent | null> {
  const existing = await getTripComponentOrThrow(db, componentId)
  assertTripComponentCanBeUpdated(existing, input)

  const updates: Partial<NewTripComponent> = {
    updatedAt: new Date(),
    ...toCatalogRefPatch(input.catalogRef),
  }
  if (input.sequence !== undefined) updates.sequence = input.sequence
  if (input.status !== undefined) updates.status = input.status
  if (input.description !== undefined) updates.description = input.description
  if (input.metadata !== undefined) updates.metadata = input.metadata
  if (input.warningCodes !== undefined) updates.warningCodes = input.warningCodes

  const [component] = (await db
    .update(tripComponents)
    .set(updates)
    .where(eq(tripComponents.id, componentId))
    .returning()) as TripComponent[]
  if (!component) return null

  await createComponentEvent(db, {
    envelopeId: component.envelopeId,
    componentId: component.id,
    eventType: input.status ? statusToEventType(input.status) : "updated",
    fromStatus: existing.status,
    toStatus: component.status,
    payload: {},
  })

  return component
}

export async function updateComponentRefs(
  db: AnyDrizzleDb,
  componentId: string,
  input: UpdateTripComponentRefsInput,
): Promise<TripComponent | null> {
  const existing = await getTripComponentOrThrow(db, componentId)
  assertTripComponentCanReceiveRefs(existing, input)

  const updates: Partial<NewTripComponent> = {
    updatedAt: new Date(),
  }
  if (input.bookingDraftId !== undefined) updates.bookingDraftId = input.bookingDraftId
  if (input.catalogQuoteId !== undefined) updates.catalogQuoteId = input.catalogQuoteId
  if (input.committedRef?.bookingId !== undefined) updates.bookingId = input.committedRef.bookingId
  if (input.committedRef?.bookingGroupId !== undefined) {
    updates.bookingGroupId = input.committedRef.bookingGroupId
  }
  if (input.committedRef?.orderId !== undefined) updates.orderId = input.committedRef.orderId
  if (input.committedRef?.paymentSessionId !== undefined) {
    updates.paymentSessionId = input.committedRef.paymentSessionId
  }
  if (input.committedRef?.providerRef !== undefined) {
    updates.providerRef = input.committedRef.providerRef
  }
  if (input.committedRef?.supplierRef !== undefined) {
    updates.supplierRef = input.committedRef.supplierRef
  }

  const [component] = (await db
    .update(tripComponents)
    .set(updates)
    .where(eq(tripComponents.id, componentId))
    .returning()) as TripComponent[]
  return component ?? null
}

export async function removeComponent(
  db: AnyDrizzleDb,
  componentId: string,
): Promise<TripComponent | null> {
  return updateComponent(db, componentId, { status: "removed" })
}

export async function reorderComponents(
  db: AnyDrizzleDb,
  input: ReorderTripComponentsInput,
): Promise<TripComponent[]> {
  const rows = (await db
    .select()
    .from(tripComponents)
    .where(inArray(tripComponents.id, input.componentIds))) as TripComponent[]

  const found = new Set(rows.map((row) => row.id))
  const missing = input.componentIds.filter((id) => !found.has(id))
  if (missing.length > 0) {
    throw new TravelComposerInvariantError(
      `Cannot reorder missing trip components: ${missing.join(", ")}`,
    )
  }

  for (const row of rows) {
    if (row.envelopeId !== input.envelopeId) {
      throw new TravelComposerInvariantError(
        `Trip component ${row.id} does not belong to envelope ${input.envelopeId}`,
      )
    }
    if (row.status === "removed") {
      throw new TravelComposerInvariantError(`Trip component ${row.id} is removed`)
    }
  }

  const updated: TripComponent[] = []
  for (const [sequence, componentId] of input.componentIds.entries()) {
    const [row] = (await db
      .update(tripComponents)
      .set({ sequence, updatedAt: new Date() })
      .where(eq(tripComponents.id, componentId))
      .returning()) as TripComponent[]
    if (row) updated.push(row)
  }

  return updated.sort((a, b) => a.sequence - b.sequence)
}

function compareEnvelopes(
  a: TripEnvelope,
  b: TripEnvelope,
  field: ListTripsQuery["sortBy"],
): number {
  switch (field) {
    case "createdAt":
      return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
    case "status":
      return a.status.localeCompare(b.status)
    case "total":
      return (a.aggregateTotalAmountCents ?? 0) - (b.aggregateTotalAmountCents ?? 0)
    default:
      return (a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0)
  }
}

function toCatalogRefPatch(input: UpdateTripComponentInput["catalogRef"]) {
  if (input === undefined) return {}
  if (input === null) {
    return {
      entityModule: null,
      entityId: null,
      sourceKind: null,
      sourceConnectionId: null,
      sourceRef: null,
    }
  }

  return {
    entityModule: input.entityModule,
    entityId: input.entityId,
    sourceKind: input.sourceKind,
    sourceConnectionId: input.sourceConnectionId ?? null,
    sourceRef: input.sourceRef ?? null,
  }
}

async function getTripComponentOrThrow(db: AnyDrizzleDb, id: string): Promise<TripComponent> {
  const [component] = (await db
    .select()
    .from(tripComponents)
    .where(eq(tripComponents.id, id))
    .limit(1)) as TripComponent[]
  if (!component) throw new TravelComposerInvariantError(`Trip component ${id} was not found`)
  return component
}
