import { newId } from "@voyantjs/db/lib/typeid"
import { and, asc, desc, eq, type SQL, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import {
  allocationAuditLog,
  allocationResources,
  availabilitySlots,
  sharingGroupLabels,
} from "./schema.js"
import type {
  assignTravelerAllocationSchema,
  insertAllocationResourceSchema,
  pairSharingGroupSchema,
  updateAllocationResourceSchema,
  updateSharingGroupLabelSchema,
  updateTravelerSharingGroupSchema,
} from "./validation.js"

export type CreateAllocationResourceInput = z.infer<typeof insertAllocationResourceSchema>
export type UpdateAllocationResourceInput = z.infer<typeof updateAllocationResourceSchema>
export type AssignTravelerAllocationInput = z.infer<typeof assignTravelerAllocationSchema>
export type UpdateTravelerSharingGroupInput = z.infer<typeof updateTravelerSharingGroupSchema>
export type PairSharingGroupInput = z.infer<typeof pairSharingGroupSchema>
export type UpdateSharingGroupLabelInput = z.infer<typeof updateSharingGroupLabelSchema>

interface SqlExecutor {
  execute(query: SQL): Promise<unknown>
}

export interface AllocationMutationOptions {
  actorId?: string | null
}

export class AllocationServiceError extends Error {
  readonly status: number
  readonly detail?: unknown

  constructor(message: string, status: number, detail?: unknown) {
    super(message)
    this.name = "AllocationServiceError"
    this.status = status
    this.detail = detail
  }
}

export interface AllocationManifestTraveler {
  id: string
  bookingId: string
  bookingNumber: string
  bookingStatus: string
  /** Aggregated payment status of the parent booking (see derivePaymentStatus). */
  paymentStatus: AllocationPaymentStatus
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string | null
  isLeadTraveler: boolean
  isPrimary: boolean
  sharingGroupId: string | null
  roomTypeId: string | null
  bedPreference: string | null
  allocations: Record<string, string>
  travelerCategory: string | null
  participantType: string
  hasAccessibilityNeeds: boolean
  hasDietaryRequirements: boolean
}

export interface AllocationManifestBooking {
  id: string
  bookingNumber: string
  status: string
  /** Aggregated payment status of the booking (see derivePaymentStatus). */
  paymentStatus: AllocationPaymentStatus
  contactFirstName: string | null
  contactLastName: string | null
  contactEmail: string | null
  contactPhone: string | null
  sellCurrency: string | null
  pax: number | null
  travelers: AllocationManifestTraveler[]
}

export interface SlotAllocationManifest {
  slot: {
    id: string
    productId: string | null
    startsAt: string | null
    endsAt: string | null
  }
  bookings: AllocationManifestBooking[]
  resources: Array<typeof allocationResources.$inferSelect>
  sharingGroupLabels: Record<string, string>
  summary: {
    bookingCount: number
    travelerCount: number
    leadTravelerCount: number
    bookingsByStatus: Record<string, number>
  }
}

export async function getSlotAllocationManifest(
  db: PostgresJsDatabase,
  slotId: string,
): Promise<SlotAllocationManifest | null> {
  const [slot] = await db
    .select({
      id: availabilitySlots.id,
      productId: availabilitySlots.productId,
      startsAt: availabilitySlots.startsAt,
      endsAt: availabilitySlots.endsAt,
    })
    .from(availabilitySlots)
    .where(eq(availabilitySlots.id, slotId))
    .limit(1)

  if (!slot) return null

  const resources = await listAllocationResources(db, slotId)
  const bookingRows = await loadSlotBookingRows(db, slotId)
  if (bookingRows.length === 0) {
    return {
      slot: serializeSlot(slot),
      bookings: [],
      resources,
      sharingGroupLabels: {},
      summary: {
        bookingCount: 0,
        travelerCount: 0,
        leadTravelerCount: 0,
        bookingsByStatus: {},
      },
    }
  }

  const bookingIds = bookingRows.map((row) => row.id)
  const travelerRows = await loadSlotTravelerRows(db, bookingIds)
  const bookingById = new Map(bookingRows.map((row) => [row.id, row]))
  const travelersByBooking = new Map<string, AllocationManifestTraveler[]>()

  for (const row of travelerRows) {
    const booking = bookingById.get(row.booking_id)
    const traveler: AllocationManifestTraveler = {
      id: row.id,
      bookingId: row.booking_id,
      bookingNumber: booking?.booking_number ?? "",
      bookingStatus: booking?.status ?? "unknown",
      paymentStatus: booking ? derivePaymentStatus(booking) : "unpaid",
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: [row.first_name, row.last_name].filter(Boolean).join(" "),
      email: row.email,
      phone: row.phone,
      isLeadTraveler: row.is_lead_traveler ?? false,
      isPrimary: row.is_primary,
      sharingGroupId: row.sharing_group_id,
      roomTypeId: row.room_type_id,
      bedPreference: row.bed_preference,
      allocations: normalizeAllocationMap(row.allocations),
      travelerCategory: row.traveler_category,
      participantType: row.participant_type,
      hasAccessibilityNeeds: row.has_accessibility_needs,
      hasDietaryRequirements: row.has_dietary_requirements,
    }
    const list = travelersByBooking.get(row.booking_id) ?? []
    list.push(traveler)
    travelersByBooking.set(row.booking_id, list)
  }

  const bookings = bookingRows.map(
    (row): AllocationManifestBooking => ({
      id: row.id,
      bookingNumber: row.booking_number,
      status: row.status,
      paymentStatus: derivePaymentStatus(row),
      contactFirstName: row.contact_first_name,
      contactLastName: row.contact_last_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      sellCurrency: row.sell_currency,
      pax: row.pax,
      travelers: travelersByBooking.get(row.id) ?? [],
    }),
  )
  const sharingGroupLabelMap = await loadSharingGroupLabelMap(
    db,
    bookings.flatMap((booking) =>
      booking.travelers.flatMap((traveler) =>
        traveler.sharingGroupId ? [traveler.sharingGroupId] : [],
      ),
    ),
  )

  return {
    slot: serializeSlot(slot),
    bookings,
    resources,
    sharingGroupLabels: sharingGroupLabelMap,
    summary: bookings.reduce(
      (acc, booking) => {
        acc.bookingCount += 1
        acc.travelerCount += booking.travelers.length
        acc.leadTravelerCount += booking.travelers.filter(
          (traveler) => traveler.isLeadTraveler,
        ).length
        acc.bookingsByStatus[booking.status] = (acc.bookingsByStatus[booking.status] ?? 0) + 1
        return acc
      },
      {
        bookingCount: 0,
        travelerCount: 0,
        leadTravelerCount: 0,
        bookingsByStatus: {} as Record<string, number>,
      },
    ),
  }
}

export async function listAllocationResources(db: PostgresJsDatabase, slotId: string) {
  return db
    .select()
    .from(allocationResources)
    .where(eq(allocationResources.slotId, slotId))
    .orderBy(
      asc(allocationResources.kind),
      asc(allocationResources.sortOrder),
      asc(allocationResources.createdAt),
    )
}

/**
 * Per-resource availability summary for a single slot: capacity, how
 * many travelers are currently assigned to that resource (across all
 * live bookings on the slot), and the resulting remaining headroom.
 * The summary is consumer-facing — `assigned` is the same DISTINCT-
 * traveler count `countResourceOccupants` uses internally, so the
 * read-side and the per-traveler assignment guardrail agree.
 *
 * Returned in (kind, sortOrder, createdAt) order so consumers can
 * render rooming grids without resorting.
 */
export interface SlotResourceAvailability {
  id: string
  slotId: string
  kind: string
  label: string | null
  refType: string | null
  refId: string | null
  parentId: string | null
  capacity: number
  assigned: number
  available: number
  flags: Record<string, unknown>
  sortOrder: number
}

export async function getSlotResourceAvailability(
  db: PostgresJsDatabase,
  slotId: string,
): Promise<SlotResourceAvailability[]> {
  const map = await getSlotsResourceAvailability(db, [slotId])
  return map.get(slotId) ?? []
}

export async function getSlotsResourceAvailability(
  db: PostgresJsDatabase,
  slotIds: string[],
): Promise<Map<string, SlotResourceAvailability[]>> {
  const uniqueIds = [...new Set(slotIds)].filter(Boolean)
  if (uniqueIds.length === 0) return new Map()

  const rows = await executeRows<{
    id: string
    slot_id: string
    kind: string
    label: string | null
    ref_type: string | null
    ref_id: string | null
    parent_id: string | null
    capacity: number
    assigned: number
    flags: Record<string, unknown> | null
    sort_order: number
  }>(
    db,
    sql`
      SELECT
        ar.id,
        ar.slot_id,
        ar.kind,
        ar.label,
        ar.ref_type,
        ar.ref_id,
        ar.parent_id,
        ar.capacity,
        COALESCE(usage.assigned, 0)::int AS assigned,
        ar.flags,
        ar.sort_order
      FROM allocation_resources ar
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT btd.traveler_id)::int AS assigned
        FROM booking_traveler_travel_details btd
        JOIN booking_travelers bt ON bt.id = btd.traveler_id
        JOIN booking_allocations ba ON ba.booking_id = bt.booking_id
        JOIN bookings b ON b.id = bt.booking_id
        WHERE btd.allocations ->> ar.kind = ar.id
          AND ba.availability_slot_id = ar.slot_id
          AND b.status IN ('draft', 'on_hold', 'confirmed', 'in_progress', 'completed')
          AND ba.status IN ('held', 'confirmed', 'fulfilled')
      ) usage ON true
      WHERE ar.slot_id = ANY(${sqlTextArray(uniqueIds)})
      ORDER BY ar.slot_id, ar.kind, ar.sort_order, ar.created_at
    `,
  )

  const out = new Map<string, SlotResourceAvailability[]>()
  for (const row of rows) {
    const capacity = row.capacity
    const assigned = row.assigned ?? 0
    const list = out.get(row.slot_id) ?? []
    list.push({
      id: row.id,
      slotId: row.slot_id,
      kind: row.kind,
      label: row.label,
      refType: row.ref_type,
      refId: row.ref_id,
      parentId: row.parent_id,
      capacity,
      assigned,
      available: Math.max(0, capacity - assigned),
      flags: row.flags ?? {},
      sortOrder: row.sort_order,
    })
    out.set(row.slot_id, list)
  }
  return out
}

export interface PlannedAllocation {
  /** Traveler id whose allocation is being planned. */
  travelerId: string
  /** Resource kind, e.g. "room" or "vehicle_seat". */
  kind: string
  /** Resource id the traveler is being assigned to. */
  resourceId: string
}

export interface ResourceCapacityViolation {
  slotId: string
  resourceId: string
  kind: string
  capacity: number
  existingAssigned: number
  requested: number
}

/**
 * Validate that a batch of planned traveler→resource assignments fits
 * inside the per-resource capacity of the given slot. Read-only —
 * callers run this before persisting so they can surface
 * `resource_capacity_exhausted` with the offending resource cited.
 *
 * Travelers in `planned` are deduped per (kind, resourceId) so the
 * caller can pass the full booking payload (one row per traveler)
 * without inflating the count. Existing usage already credited to a
 * traveler being re-planned is excluded so re-saving the same payload
 * is idempotent.
 */
export async function validateSlotAllocationCapacity(
  db: PostgresJsDatabase,
  slotId: string,
  planned: PlannedAllocation[],
): Promise<ResourceCapacityViolation[]> {
  if (planned.length === 0) return []

  const byResource = new Map<string, { kind: string; travelerIds: Set<string> }>()
  for (const entry of planned) {
    if (!entry.resourceId || !entry.kind) continue
    const bucket = byResource.get(entry.resourceId) ?? {
      kind: entry.kind,
      travelerIds: new Set<string>(),
    }
    bucket.travelerIds.add(entry.travelerId)
    byResource.set(entry.resourceId, bucket)
  }

  if (byResource.size === 0) return []

  const resourceIds = [...byResource.keys()]
  // Lock the targeted rows so a concurrent caller cannot pass the
  // same check before this one persists. Callers must run inside a
  // transaction for the lock to span until commit; outside one this
  // is the same race as before, but the helper at least documents
  // the contract.
  const resources = await executeRows<{
    id: string
    kind: string
    capacity: number
    slot_id: string
  }>(
    db,
    sql`
      SELECT id, kind, capacity, slot_id
      FROM allocation_resources
      WHERE slot_id = ${slotId} AND id = ANY(${sqlTextArray(resourceIds)})
      FOR UPDATE
    `,
  )
  const resourceById = new Map(resources.map((r) => [r.id, r]))

  const violations: ResourceCapacityViolation[] = []
  for (const [resourceId, plan] of byResource) {
    const resource = resourceById.get(resourceId)
    if (!resource) {
      violations.push({
        slotId,
        resourceId,
        kind: plan.kind,
        capacity: 0,
        existingAssigned: 0,
        requested: plan.travelerIds.size,
      })
      continue
    }
    if (resource.kind !== plan.kind) {
      violations.push({
        slotId,
        resourceId,
        kind: plan.kind,
        capacity: resource.capacity,
        existingAssigned: 0,
        requested: plan.travelerIds.size,
      })
      continue
    }

    const travelerIdsArr = [...plan.travelerIds]
    const existingRows = await executeRows<{ count: number }>(
      db,
      sql`
        SELECT COUNT(DISTINCT btd.traveler_id)::int AS count
        FROM booking_traveler_travel_details btd
        JOIN booking_travelers bt ON bt.id = btd.traveler_id
        JOIN booking_allocations ba ON ba.booking_id = bt.booking_id
        JOIN bookings b ON b.id = bt.booking_id
        WHERE btd.allocations ->> ${plan.kind} = ${resourceId}
          AND ba.availability_slot_id = ${slotId}
          AND b.status IN ('draft', 'on_hold', 'confirmed', 'in_progress', 'completed')
          AND ba.status IN ('held', 'confirmed', 'fulfilled')
          AND btd.traveler_id <> ALL(${sqlTextArray(travelerIdsArr)})
      `,
    )
    const existingAssigned = existingRows[0]?.count ?? 0
    const total = existingAssigned + plan.travelerIds.size
    if (total > resource.capacity) {
      violations.push({
        slotId,
        resourceId,
        kind: plan.kind,
        capacity: resource.capacity,
        existingAssigned,
        requested: plan.travelerIds.size,
      })
    }
  }
  return violations
}

export async function createAllocationResource(
  db: PostgresJsDatabase,
  slotId: string,
  input: CreateAllocationResourceInput,
  options: AllocationMutationOptions = {},
) {
  const [slot] = await db
    .select({ id: availabilitySlots.id })
    .from(availabilitySlots)
    .where(eq(availabilitySlots.id, slotId))
    .limit(1)
  if (!slot) return null

  const [row] = await db
    .insert(allocationResources)
    .values({
      slotId,
      kind: input.kind,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      label: input.label ?? null,
      capacity: input.capacity,
      flags: input.flags ?? {},
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning()
  if (row) {
    await recordAllocationAudit(db, {
      slotId,
      action: "resource.create",
      actorId: options.actorId ?? null,
      resourceId: row.id,
      after: {
        kind: row.kind,
        label: row.label,
        capacity: row.capacity,
      },
    })
  }
  return row ?? null
}

export async function updateAllocationResource(
  db: PostgresJsDatabase,
  slotId: string,
  resourceId: string,
  input: UpdateAllocationResourceInput,
  options: AllocationMutationOptions = {},
) {
  const [existing] = await db
    .select({
      id: allocationResources.id,
      kind: allocationResources.kind,
      label: allocationResources.label,
      capacity: allocationResources.capacity,
      flags: allocationResources.flags,
      sortOrder: allocationResources.sortOrder,
    })
    .from(allocationResources)
    .where(and(eq(allocationResources.id, resourceId), eq(allocationResources.slotId, slotId)))
    .limit(1)
  if (!existing) return null

  if (input.capacity !== undefined) {
    const current = await countResourceOccupants(db, slotId, existing.kind, resourceId)
    if (current > input.capacity) {
      throw new AllocationServiceError("Resource over capacity", 409, {
        capacity: input.capacity,
        current,
      })
    }
  }

  const patch = {
    ...input,
    updatedAt: new Date(),
  }

  const [row] = await db
    .update(allocationResources)
    .set(patch)
    .where(and(eq(allocationResources.id, resourceId), eq(allocationResources.slotId, slotId)))
    .returning()
  if (row) {
    await recordAllocationAudit(db, {
      slotId,
      action: "resource.update",
      actorId: options.actorId ?? null,
      resourceId: row.id,
      before: {
        label: existing.label,
        capacity: existing.capacity,
        flags: existing.flags,
        sortOrder: existing.sortOrder,
      },
      after: {
        label: row.label,
        capacity: row.capacity,
        flags: row.flags,
        sortOrder: row.sortOrder,
      },
    })
  }
  return row ?? null
}

export async function deleteAllocationResource(
  db: PostgresJsDatabase,
  slotId: string,
  resourceId: string,
  options: AllocationMutationOptions = {},
) {
  const [row] = await db
    .delete(allocationResources)
    .where(and(eq(allocationResources.id, resourceId), eq(allocationResources.slotId, slotId)))
    .returning({
      id: allocationResources.id,
      kind: allocationResources.kind,
      label: allocationResources.label,
      capacity: allocationResources.capacity,
    })
  if (row) {
    await clearTravelerAllocationsForResource(db, resourceId)
    await recordAllocationAudit(db, {
      slotId,
      action: "resource.delete",
      actorId: options.actorId ?? null,
      resourceId: row.id,
      before: {
        kind: row.kind,
        label: row.label,
        capacity: row.capacity,
      },
    })
  }
  return row ?? null
}

export async function assignTravelerAllocation(
  db: PostgresJsDatabase,
  slotId: string,
  travelerId: string,
  input: AssignTravelerAllocationInput,
  options: AllocationMutationOptions = {},
) {
  let beforeResourceId: string | null = null
  await db.transaction(async (tx) => {
    await assertTravelerBelongsToSlot(tx, slotId, travelerId)
    beforeResourceId = await getTravelerAllocation(tx, travelerId, input.kind)

    if (input.resourceId) {
      const [resource] = await executeRows<{
        id: string
        kind: string
        capacity: number
      }>(
        tx,
        sql`
          SELECT id, kind, capacity
          FROM allocation_resources
          WHERE id = ${input.resourceId}
            AND slot_id = ${slotId}
            AND kind = ${input.kind}
          FOR UPDATE
        `,
      )

      if (!resource) {
        throw new AllocationServiceError("Resource not found for this slot/kind", 404)
      }

      const current = await countResourceOccupants(
        tx,
        slotId,
        input.kind,
        input.resourceId,
        travelerId,
      )
      if (current + 1 > resource.capacity) {
        throw new AllocationServiceError("Resource over capacity", 409, {
          capacity: resource.capacity,
          current,
        })
      }
    }

    await ensureTravelerTravelDetailsRow(tx, travelerId)

    if (input.resourceId) {
      await tx.execute(sql`
        UPDATE booking_traveler_travel_details
        SET allocations = COALESCE(allocations, '{}'::jsonb) || jsonb_build_object(${input.kind}::text, ${input.resourceId}::text),
            updated_at = now()
        WHERE traveler_id = ${travelerId}
      `)
    } else {
      await tx.execute(sql`
        UPDATE booking_traveler_travel_details
        SET allocations = COALESCE(allocations, '{}'::jsonb) - ${input.kind}::text,
            updated_at = now()
        WHERE traveler_id = ${travelerId}
      `)
    }
  })
  await recordAllocationAudit(db, {
    slotId,
    action: input.resourceId ? "traveler.assign" : "traveler.unassign",
    actorId: options.actorId ?? null,
    travelerId,
    before: { kind: input.kind, resourceId: beforeResourceId },
    after: { kind: input.kind, resourceId: input.resourceId },
  })

  return { travelerId, kind: input.kind, resourceId: input.resourceId }
}

export async function updateTravelerSharingGroup(
  db: PostgresJsDatabase,
  slotId: string,
  travelerId: string,
  input: UpdateTravelerSharingGroupInput,
  options: AllocationMutationOptions = {},
) {
  await assertTravelerBelongsToSlot(db, slotId, travelerId)
  const beforeSharingGroupId = await getTravelerSharingGroup(db, travelerId)
  await db.execute(sql`
    INSERT INTO booking_traveler_travel_details (traveler_id, sharing_group_id)
    VALUES (${travelerId}, ${input.sharingGroupId})
    ON CONFLICT (traveler_id) DO UPDATE SET
      sharing_group_id = ${input.sharingGroupId},
      updated_at = now()
  `)
  await recordAllocationAudit(db, {
    slotId,
    action: input.sharingGroupId ? "traveler.sharing-group.set" : "traveler.sharing-group.clear",
    actorId: options.actorId ?? null,
    travelerId,
    before: { sharingGroupId: beforeSharingGroupId },
    after: { sharingGroupId: input.sharingGroupId },
  })

  return { travelerId, sharingGroupId: input.sharingGroupId }
}

export async function pairSharingGroup(
  db: PostgresJsDatabase,
  slotId: string,
  input: PairSharingGroupInput,
  options: AllocationMutationOptions = {},
) {
  for (const travelerId of input.travelerIds) {
    await assertTravelerBelongsToSlot(db, slotId, travelerId)
  }

  const sharingGroupId = input.sharingGroupId ?? globalThis.crypto.randomUUID()
  await db.execute(sql`
    INSERT INTO booking_traveler_travel_details (traveler_id, sharing_group_id)
    SELECT id, ${sharingGroupId}
    FROM unnest(${sqlTextArray(input.travelerIds)}) AS u(id)
    ON CONFLICT (traveler_id) DO UPDATE SET
      sharing_group_id = EXCLUDED.sharing_group_id,
      updated_at = now()
  `)
  await recordAllocationAudit(db, {
    slotId,
    action: "traveler.sharing-group.set",
    actorId: options.actorId ?? null,
    after: { sharingGroupId, travelerIds: input.travelerIds },
  })

  return { sharingGroupId, travelerIds: input.travelerIds }
}

export async function updateSharingGroupLabel(
  db: PostgresJsDatabase,
  slotId: string,
  groupId: string,
  input: UpdateSharingGroupLabelInput,
  options: AllocationMutationOptions = {},
) {
  await assertSharingGroupBelongsToSlot(db, slotId, groupId)
  const [row] = await db
    .insert(sharingGroupLabels)
    .values({ groupId, label: input.label })
    .onConflictDoUpdate({
      target: sharingGroupLabels.groupId,
      set: { label: input.label, updatedAt: new Date() },
    })
    .returning()
  await recordAllocationAudit(db, {
    slotId,
    action: "sharing-group.label.update",
    actorId: options.actorId ?? null,
    after: { sharingGroupId: groupId, label: row?.label ?? input.label },
  })
  return row ?? { groupId, label: input.label, createdAt: new Date(), updatedAt: new Date() }
}

export async function deleteSharingGroupLabel(
  db: PostgresJsDatabase,
  slotId: string,
  groupId: string,
  options: AllocationMutationOptions = {},
) {
  await assertSharingGroupBelongsToSlot(db, slotId, groupId)
  const [row] = await db
    .delete(sharingGroupLabels)
    .where(eq(sharingGroupLabels.groupId, groupId))
    .returning()
  if (row) {
    await recordAllocationAudit(db, {
      slotId,
      action: "sharing-group.label.clear",
      actorId: options.actorId ?? null,
      before: { sharingGroupId: groupId, label: row.label },
    })
  }
  return row ?? null
}

export interface AllocationAuditLogEntry {
  id: string
  slotId: string
  action: string
  actorId: string | null
  travelerId: string | null
  resourceId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  createdAt: string
}

export async function listAllocationAuditLog(
  db: PostgresJsDatabase,
  slotId: string,
  limit = 50,
): Promise<AllocationAuditLogEntry[]> {
  const rows = await db
    .select()
    .from(allocationAuditLog)
    .where(eq(allocationAuditLog.slotId, slotId))
    .orderBy(desc(allocationAuditLog.createdAt))
    .limit(limit)
  return rows.map((row) => ({
    id: row.id,
    slotId: row.slotId,
    action: row.action,
    actorId: row.actorId,
    travelerId: row.travelerId,
    resourceId: row.resourceId,
    before: row.before ?? null,
    after: row.after ?? null,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function recordAllocationAudit(
  db: SqlExecutor,
  input: {
    slotId: string
    action: string
    actorId?: string | null
    travelerId?: string | null
    resourceId?: string | null
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
  },
) {
  await db.execute(sql`
    INSERT INTO allocation_audit_log (id, slot_id, action, actor_id, traveler_id, resource_id, before, after)
    VALUES (
      ${newId("allocation_audit_log")},
      ${input.slotId},
      ${input.action},
      ${input.actorId ?? null},
      ${input.travelerId ?? null},
      ${input.resourceId ?? null},
      ${JSON.stringify(input.before ?? null)}::jsonb,
      ${JSON.stringify(input.after ?? null)}::jsonb
    )
  `)
}

async function ensureTravelerTravelDetailsRow(db: SqlExecutor, travelerId: string) {
  await db.execute(sql`
    INSERT INTO booking_traveler_travel_details (traveler_id)
    VALUES (${travelerId})
    ON CONFLICT (traveler_id) DO NOTHING
  `)
}

async function getTravelerAllocation(db: SqlExecutor, travelerId: string, kind: string) {
  const rows = await executeRows<{ resource_id: string | null }>(
    db,
    sql`
    SELECT allocations ->> ${kind} AS resource_id
    FROM booking_traveler_travel_details
    WHERE traveler_id = ${travelerId}
    LIMIT 1
  `,
  )
  return rows[0]?.resource_id ?? null
}

async function getTravelerSharingGroup(db: SqlExecutor, travelerId: string) {
  const rows = await executeRows<{ sharing_group_id: string | null }>(
    db,
    sql`
    SELECT sharing_group_id
    FROM booking_traveler_travel_details
    WHERE traveler_id = ${travelerId}
    LIMIT 1
  `,
  )
  return rows[0]?.sharing_group_id ?? null
}

async function assertTravelerBelongsToSlot(db: SqlExecutor, slotId: string, travelerId: string) {
  const rows = await executeRows<{ exists: number }>(
    db,
    sql`
    SELECT 1 AS exists
    FROM booking_travelers bt
    JOIN booking_allocations ba ON ba.booking_id = bt.booking_id
    JOIN bookings b ON b.id = bt.booking_id
    WHERE bt.id = ${travelerId}
      AND ba.availability_slot_id = ${slotId}
      AND b.status IN ('draft', 'on_hold', 'confirmed', 'in_progress', 'completed')
      AND ba.status IN ('held', 'confirmed', 'fulfilled')
    LIMIT 1
  `,
  )

  if (rows.length === 0) {
    throw new AllocationServiceError("Traveler not found for this slot", 404)
  }
}

async function assertSharingGroupBelongsToSlot(db: SqlExecutor, slotId: string, groupId: string) {
  const rows = await executeRows<{ exists: number }>(
    db,
    sql`
    SELECT 1 AS exists
    FROM booking_traveler_travel_details btd
    JOIN booking_travelers bt ON bt.id = btd.traveler_id
    JOIN booking_allocations ba ON ba.booking_id = bt.booking_id
    JOIN bookings b ON b.id = bt.booking_id
    WHERE btd.sharing_group_id = ${groupId}
      AND ba.availability_slot_id = ${slotId}
      AND b.status IN ('draft', 'on_hold', 'confirmed', 'in_progress', 'completed')
      AND ba.status IN ('held', 'confirmed', 'fulfilled')
    LIMIT 1
  `,
  )

  if (rows.length === 0) {
    throw new AllocationServiceError("Sharing group not found for this slot", 404)
  }
}

async function countResourceOccupants(
  db: SqlExecutor,
  slotId: string,
  kind: string,
  resourceId: string,
  excludeTravelerId?: string,
) {
  const rows = await executeRows<{ count: number }>(
    db,
    sql`
    SELECT COUNT(DISTINCT btd.traveler_id)::int AS count
    FROM booking_traveler_travel_details btd
    JOIN booking_travelers bt ON bt.id = btd.traveler_id
    JOIN booking_allocations ba ON ba.booking_id = bt.booking_id
    JOIN bookings b ON b.id = bt.booking_id
    WHERE btd.allocations ->> ${kind} = ${resourceId}
      AND ba.availability_slot_id = ${slotId}
      AND b.status IN ('draft', 'on_hold', 'confirmed', 'in_progress', 'completed')
      AND ba.status IN ('held', 'confirmed', 'fulfilled')
      AND (${excludeTravelerId ?? null}::text IS NULL OR btd.traveler_id <> ${excludeTravelerId ?? null})
  `,
  )

  return rows[0]?.count ?? 0
}

async function clearTravelerAllocationsForResource(db: PostgresJsDatabase, resourceId: string) {
  await db.execute(sql`
    UPDATE booking_traveler_travel_details btd
    SET allocations = COALESCE((
      SELECT jsonb_object_agg(key, value)
      FROM jsonb_each(COALESCE(btd.allocations, '{}'::jsonb))
      WHERE value <> to_jsonb(${resourceId}::text)
    ), '{}'::jsonb),
    updated_at = now()
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_each(COALESCE(btd.allocations, '{}'::jsonb))
      WHERE value = to_jsonb(${resourceId}::text)
    )
  `)
}

async function loadSharingGroupLabelMap(
  db: PostgresJsDatabase,
  groupIds: string[],
): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(groupIds)]
  if (uniqueIds.length === 0) return {}

  const rows = await db
    .select({
      groupId: sharingGroupLabels.groupId,
      label: sharingGroupLabels.label,
    })
    .from(sharingGroupLabels)
    .where(sql`${sharingGroupLabels.groupId} = ANY(${sqlTextArray(uniqueIds)})`)

  return Object.fromEntries(rows.map((row) => [row.groupId, row.label]))
}

async function executeRows<T>(db: SqlExecutor, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  // node-postgres / neon-serverless drivers return `{ rows, rowCount, ... }`
  // instead of a bare array — unwrap so this wrapper is driver-agnostic.
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows
  }
  return []
}

/**
 * Emit a Postgres `ARRAY[$1, $2, …]::text[]` literal instead of the
 * naive `${jsArray}::text[]` form. drizzle's `sql` template spreads
 * JS arrays into a row constructor (`($1, $2)`) which Postgres
 * refuses to cast to `text[]` — see issue #952. Empty input returns
 * `ARRAY[]::text[]` which Postgres accepts.
 */
function sqlTextArray(values: readonly string[]): SQL {
  if (values.length === 0) return sql`ARRAY[]::text[]`
  return sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}`),
    sql.raw(", "),
  )}]::text[]`
}

function serializeSlot(slot: {
  id: string
  productId: string | null
  startsAt: Date
  endsAt: Date | null
}) {
  return {
    id: slot.id,
    productId: slot.productId ?? null,
    startsAt: slot.startsAt ? slot.startsAt.toISOString() : null,
    endsAt: slot.endsAt ? slot.endsAt.toISOString() : null,
  }
}

interface BookingRow {
  id: string
  booking_number: string
  status: string
  contact_first_name: string | null
  contact_last_name: string | null
  contact_email: string | null
  contact_phone: string | null
  sell_currency: string | null
  pax: number | null
  sell_amount_cents: number | null
  invoice_total_cents: number | null
  invoice_paid_cents: number | null
}

export type AllocationPaymentStatus = "paid" | "partial" | "unpaid"

/**
 * Roll up a booking's invoices into a single paid / partial / unpaid
 * status for the allocation chip's color coding.
 *
 *   - No invoices issued → `unpaid` (booking exists but hasn't been
 *     billed yet; operator has charged no money).
 *   - Free booking (sell amount 0) → `paid` (nothing owed).
 *   - All invoices fully paid → `paid`.
 *   - Some paid, some still due → `partial`.
 *   - Nothing paid → `unpaid`.
 */
function derivePaymentStatus(row: BookingRow): AllocationPaymentStatus {
  const sellAmount = row.sell_amount_cents ?? 0
  if (sellAmount <= 0) return "paid"
  const invoiceTotal = row.invoice_total_cents ?? 0
  const invoicePaid = row.invoice_paid_cents ?? 0
  if (invoiceTotal === 0) return "unpaid"
  if (invoicePaid <= 0) return "unpaid"
  if (invoicePaid >= invoiceTotal) return "paid"
  return "partial"
}

interface TravelerRow {
  id: string
  booking_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  is_primary: boolean
  participant_type: string
  traveler_category: string | null
  is_lead_traveler: boolean | null
  sharing_group_id: string | null
  room_type_id: string | null
  bed_preference: string | null
  allocations: unknown
  has_accessibility_needs: boolean
  has_dietary_requirements: boolean
}

async function loadSlotBookingRows(db: PostgresJsDatabase, slotId: string): Promise<BookingRow[]> {
  // `invoice_totals` is a LEFT JOIN aggregation that may reference a
  // missing `invoices` table in catalog-less / finance-less deploys —
  // we'd want to silently fall back to `unpaid` for every booking
  // rather than crash the manifest fetch. Hence the try / catch on
  // `undefined_table` (Postgres 42P01) with a non-aggregating retry.
  try {
    return await executeRows<BookingRow>(
      db,
      sql`
      SELECT DISTINCT
        b.id,
        b.booking_number,
        b.status,
        b.contact_first_name,
        b.contact_last_name,
        b.contact_email,
        b.contact_phone,
        b.sell_currency,
        b.pax,
        b.sell_amount_cents,
        COALESCE(inv.total_cents, 0) AS invoice_total_cents,
        COALESCE(inv.paid_cents, 0) AS invoice_paid_cents
      FROM bookings b
      JOIN booking_allocations ba ON ba.booking_id = b.id
      LEFT JOIN (
        SELECT
          booking_id,
          SUM(total_cents) AS total_cents,
          SUM(paid_cents) AS paid_cents
        FROM invoices
        WHERE status <> 'void'
        GROUP BY booking_id
      ) inv ON inv.booking_id = b.id
      WHERE ba.availability_slot_id = ${slotId}
        AND b.status IN ('draft', 'on_hold', 'confirmed', 'in_progress', 'completed')
        AND ba.status IN ('held', 'confirmed', 'fulfilled')
      ORDER BY b.booking_number
    `,
    )
  } catch (error) {
    if (!isUndefinedTableError(error)) throw error
    const rows = await executeRows<Omit<BookingRow, "invoice_total_cents" | "invoice_paid_cents">>(
      db,
      sql`
      SELECT DISTINCT
        b.id,
        b.booking_number,
        b.status,
        b.contact_first_name,
        b.contact_last_name,
        b.contact_email,
        b.contact_phone,
        b.sell_currency,
        b.pax,
        b.sell_amount_cents
      FROM bookings b
      JOIN booking_allocations ba ON ba.booking_id = b.id
      WHERE ba.availability_slot_id = ${slotId}
        AND b.status IN ('draft', 'on_hold', 'confirmed', 'in_progress', 'completed')
        AND ba.status IN ('held', 'confirmed', 'fulfilled')
      ORDER BY b.booking_number
    `,
    )
    return rows.map((row) => ({ ...row, invoice_total_cents: 0, invoice_paid_cents: 0 }))
  }
}

function isUndefinedTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  )
}

async function loadSlotTravelerRows(
  db: PostgresJsDatabase,
  bookingIds: string[],
): Promise<TravelerRow[]> {
  return executeRows<TravelerRow>(
    db,
    sql`
    SELECT
      bt.id,
      bt.booking_id,
      bt.first_name,
      bt.last_name,
      bt.email,
      bt.phone,
      bt.is_primary,
      bt.participant_type,
      bt.traveler_category,
      COALESCE(btd.is_lead_traveler, false) AS is_lead_traveler,
      btd.sharing_group_id,
      btd.room_type_id,
      btd.bed_preference,
      COALESCE(btd.allocations, '{}'::jsonb) AS allocations,
      (btd.accessibility_encrypted IS NOT NULL) AS has_accessibility_needs,
      (btd.dietary_encrypted IS NOT NULL) AS has_dietary_requirements
    FROM booking_travelers bt
    LEFT JOIN booking_traveler_travel_details btd ON btd.traveler_id = bt.id
    WHERE bt.booking_id = ANY(${sqlTextArray(bookingIds)})
    ORDER BY bt.booking_id, bt.is_primary DESC, bt.created_at
  `,
  )
}

function normalizeAllocationMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}

  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string") out[key] = raw
  }
  return out
}
