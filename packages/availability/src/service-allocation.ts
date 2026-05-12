import { and, asc, eq, type SQL, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import { allocationResources, availabilitySlots } from "./schema.js"
import type {
  assignTravelerAllocationSchema,
  insertAllocationResourceSchema,
  pairSharingGroupSchema,
  updateAllocationResourceSchema,
  updateTravelerSharingGroupSchema,
} from "./validation.js"

export type CreateAllocationResourceInput = z.infer<typeof insertAllocationResourceSchema>
export type UpdateAllocationResourceInput = z.infer<typeof updateAllocationResourceSchema>
export type AssignTravelerAllocationInput = z.infer<typeof assignTravelerAllocationSchema>
export type UpdateTravelerSharingGroupInput = z.infer<typeof updateTravelerSharingGroupSchema>
export type PairSharingGroupInput = z.infer<typeof pairSharingGroupSchema>

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
      contactFirstName: row.contact_first_name,
      contactLastName: row.contact_last_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      sellCurrency: row.sell_currency,
      pax: row.pax,
      travelers: travelersByBooking.get(row.id) ?? [],
    }),
  )

  return {
    slot: serializeSlot(slot),
    bookings,
    resources,
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

export async function createAllocationResource(
  db: PostgresJsDatabase,
  slotId: string,
  input: CreateAllocationResourceInput,
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
  return row ?? null
}

export async function updateAllocationResource(
  db: PostgresJsDatabase,
  slotId: string,
  resourceId: string,
  input: UpdateAllocationResourceInput,
) {
  const [existing] = await db
    .select({
      id: allocationResources.id,
      kind: allocationResources.kind,
    })
    .from(allocationResources)
    .where(and(eq(allocationResources.id, resourceId), eq(allocationResources.slotId, slotId)))
    .limit(1)
  if (!existing) return null

  if (input.capacity !== undefined) {
    const current = await countResourceOccupants(db, existing.kind, resourceId)
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
  return row ?? null
}

export async function deleteAllocationResource(
  db: PostgresJsDatabase,
  slotId: string,
  resourceId: string,
) {
  const [row] = await db
    .delete(allocationResources)
    .where(and(eq(allocationResources.id, resourceId), eq(allocationResources.slotId, slotId)))
    .returning({ id: allocationResources.id })
  if (row) await clearTravelerAllocationsForResource(db, resourceId)
  return row ?? null
}

export async function assignTravelerAllocation(
  db: PostgresJsDatabase,
  slotId: string,
  travelerId: string,
  input: AssignTravelerAllocationInput,
) {
  await assertTravelerBelongsToSlot(db, slotId, travelerId)

  if (input.resourceId) {
    const [resource] = await db
      .select({
        id: allocationResources.id,
        kind: allocationResources.kind,
        capacity: allocationResources.capacity,
      })
      .from(allocationResources)
      .where(
        and(
          eq(allocationResources.id, input.resourceId),
          eq(allocationResources.slotId, slotId),
          eq(allocationResources.kind, input.kind),
        ),
      )
      .limit(1)

    if (!resource) {
      throw new AllocationServiceError("Resource not found for this slot/kind", 404)
    }

    const current = await countResourceOccupants(db, input.kind, input.resourceId, travelerId)
    if (current + 1 > resource.capacity) {
      throw new AllocationServiceError("Resource over capacity", 409, {
        capacity: resource.capacity,
        current,
      })
    }
  }

  await ensureTravelerTravelDetailsRow(db, travelerId)

  if (input.resourceId) {
    await db.execute(sql`
      UPDATE booking_traveler_travel_details
      SET allocations = COALESCE(allocations, '{}'::jsonb) || jsonb_build_object(${input.kind}::text, ${input.resourceId}::text),
          updated_at = now()
      WHERE traveler_id = ${travelerId}
    `)
  } else {
    await db.execute(sql`
      UPDATE booking_traveler_travel_details
      SET allocations = COALESCE(allocations, '{}'::jsonb) - ${input.kind}::text,
          updated_at = now()
      WHERE traveler_id = ${travelerId}
    `)
  }

  return { travelerId, kind: input.kind, resourceId: input.resourceId }
}

export async function updateTravelerSharingGroup(
  db: PostgresJsDatabase,
  slotId: string,
  travelerId: string,
  input: UpdateTravelerSharingGroupInput,
) {
  await assertTravelerBelongsToSlot(db, slotId, travelerId)
  await db.execute(sql`
    INSERT INTO booking_traveler_travel_details (traveler_id, sharing_group_id)
    VALUES (${travelerId}, ${input.sharingGroupId})
    ON CONFLICT (traveler_id) DO UPDATE SET
      sharing_group_id = ${input.sharingGroupId},
      updated_at = now()
  `)

  return { travelerId, sharingGroupId: input.sharingGroupId }
}

export async function pairSharingGroup(
  db: PostgresJsDatabase,
  slotId: string,
  input: PairSharingGroupInput,
) {
  for (const travelerId of input.travelerIds) {
    await assertTravelerBelongsToSlot(db, slotId, travelerId)
  }

  const sharingGroupId = input.sharingGroupId ?? globalThis.crypto.randomUUID()
  await db.execute(sql`
    INSERT INTO booking_traveler_travel_details (traveler_id, sharing_group_id)
    SELECT id, ${sharingGroupId}
    FROM unnest(${input.travelerIds}::text[]) AS u(id)
    ON CONFLICT (traveler_id) DO UPDATE SET
      sharing_group_id = EXCLUDED.sharing_group_id,
      updated_at = now()
  `)

  return { sharingGroupId, travelerIds: input.travelerIds }
}

async function ensureTravelerTravelDetailsRow(db: PostgresJsDatabase, travelerId: string) {
  await db.execute(sql`
    INSERT INTO booking_traveler_travel_details (traveler_id)
    VALUES (${travelerId})
    ON CONFLICT (traveler_id) DO NOTHING
  `)
}

async function assertTravelerBelongsToSlot(
  db: PostgresJsDatabase,
  slotId: string,
  travelerId: string,
) {
  const rows = await executeRows<{ exists: number }>(
    db,
    sql`
    SELECT 1 AS exists
    FROM booking_travelers bt
    JOIN booking_allocations ba ON ba.booking_id = bt.booking_id
    WHERE bt.id = ${travelerId}
      AND ba.availability_slot_id = ${slotId}
    LIMIT 1
  `,
  )

  if (rows.length === 0) {
    throw new AllocationServiceError("Traveler not found for this slot", 404)
  }
}

async function countResourceOccupants(
  db: PostgresJsDatabase,
  kind: string,
  resourceId: string,
  excludeTravelerId?: string,
) {
  const rows = await executeRows<{ count: number }>(
    db,
    sql`
    SELECT COUNT(*)::int AS count
    FROM booking_traveler_travel_details
    WHERE allocations ->> ${kind} = ${resourceId}
      AND (${excludeTravelerId ?? null}::text IS NULL OR traveler_id <> ${excludeTravelerId ?? null})
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

async function executeRows<T>(db: PostgresJsDatabase, query: SQL): Promise<T[]> {
  const rows = await db.execute(query)
  return Array.isArray(rows) ? (rows as T[]) : []
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
  return executeRows<BookingRow>(
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
      b.pax
    FROM bookings b
    JOIN booking_allocations ba ON ba.booking_id = b.id
    WHERE ba.availability_slot_id = ${slotId}
    ORDER BY b.booking_number
  `,
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
    WHERE bt.booking_id = ANY(${bookingIds}::text[])
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
