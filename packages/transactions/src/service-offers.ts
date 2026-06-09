import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  offerContactAssignments,
  offerItemParticipants,
  offerItems,
  offerParticipants,
  offerStaffAssignments,
  offers,
} from "./schema.js"
import type {
  CreateOfferBundleInput,
  CreateOfferContactAssignmentInput,
  CreateOfferInput,
  CreateOfferItemInput,
  CreateOfferItemTravelerInput,
  CreateOfferStaffAssignmentInput,
  CreateOfferTravelerInput,
  OfferContactAssignmentListQuery,
  OfferItemListQuery,
  OfferItemTravelerListQuery,
  OfferListQuery,
  OfferStaffAssignmentListQuery,
  OfferTravelerListQuery,
  UpdateOfferContactAssignmentInput,
  UpdateOfferInput,
  UpdateOfferItemInput,
  UpdateOfferItemTravelerInput,
  UpdateOfferStaffAssignmentInput,
  UpdateOfferTravelerInput,
} from "./service-shared.js"
import {
  normalizeTimestamp,
  paginate,
  toOfferContactAssignmentResponse,
  toOfferItemTravelerResponse,
  toOfferStaffAssignmentResponse,
  toOfferTravelerResponse,
} from "./service-shared.js"

function isStaffParticipantType(participantType: string | null | undefined) {
  return participantType === "staff"
}

function toStaffAssignmentRole(role: string | null | undefined) {
  return role === "service_assignee" ? "service_assignee" : "other"
}

function pickPrimaryContactSnapshot(
  offer: CreateOfferInput,
  contactAssignments: NonNullable<CreateOfferBundleInput["contactAssignments"]>,
): Pick<
  CreateOfferInput,
  | "contactFirstName"
  | "contactLastName"
  | "contactPartyType"
  | "contactTaxId"
  | "contactEmail"
  | "contactPhone"
  | "contactPreferredLanguage"
  | "contactCountry"
  | "contactRegion"
  | "contactCity"
  | "contactAddressLine1"
  | "contactAddressLine2"
  | "contactPostalCode"
> {
  if (
    offer.contactFirstName ??
    offer.contactLastName ??
    offer.contactPartyType ??
    offer.contactTaxId ??
    offer.contactEmail ??
    offer.contactPhone ??
    offer.contactPreferredLanguage ??
    offer.contactCountry ??
    offer.contactRegion ??
    offer.contactCity ??
    offer.contactAddressLine1 ??
    offer.contactAddressLine2 ??
    offer.contactPostalCode
  ) {
    return {
      contactFirstName: offer.contactFirstName ?? null,
      contactLastName: offer.contactLastName ?? null,
      contactPartyType: offer.contactPartyType ?? null,
      contactTaxId: offer.contactTaxId ?? null,
      contactEmail: offer.contactEmail ?? null,
      contactPhone: offer.contactPhone ?? null,
      contactPreferredLanguage: offer.contactPreferredLanguage ?? null,
      contactCountry: offer.contactCountry ?? null,
      contactRegion: offer.contactRegion ?? null,
      contactCity: offer.contactCity ?? null,
      contactAddressLine1: offer.contactAddressLine1 ?? null,
      contactAddressLine2: offer.contactAddressLine2 ?? null,
      contactPostalCode: offer.contactPostalCode ?? null,
    }
  }

  const contactAssignment =
    contactAssignments.find(
      (assignment) => assignment.role === "primary_contact" && assignment.isPrimary,
    ) ??
    contactAssignments.find((assignment) => assignment.role === "primary_contact") ??
    contactAssignments.find((assignment) => assignment.isPrimary) ??
    contactAssignments[0] ??
    null

  return {
    contactFirstName: contactAssignment?.firstName ?? null,
    contactLastName: contactAssignment?.lastName ?? null,
    contactPartyType: contactAssignment ? "individual" : null,
    contactTaxId: null,
    contactEmail: contactAssignment?.email ?? null,
    contactPhone: contactAssignment?.phone ?? null,
    contactPreferredLanguage: contactAssignment?.preferredLanguage ?? null,
    contactCountry: null,
    contactRegion: null,
    contactCity: null,
    contactAddressLine1: null,
    contactAddressLine2: null,
    contactPostalCode: null,
  }
}

export async function listOffers(db: PostgresJsDatabase, query: OfferListQuery) {
  const conditions = []
  if (query.status) conditions.push(eq(offers.status, query.status))
  if (query.quoteId) conditions.push(eq(offers.quoteId, query.quoteId))
  if (query.quoteVersionId) conditions.push(eq(offers.quoteVersionId, query.quoteVersionId))
  if (query.personId) conditions.push(eq(offers.personId, query.personId))
  if (query.organizationId) conditions.push(eq(offers.organizationId, query.organizationId))
  if (query.marketId) conditions.push(eq(offers.marketId, query.marketId))
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(or(ilike(offers.offerNumber, term), ilike(offers.title, term)))
  }
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(offers)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(offers.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(offers).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOfferById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(offers).where(eq(offers.id, id)).limit(1)
  return row ?? null
}

export async function createOffer(db: PostgresJsDatabase, data: CreateOfferInput) {
  const { sentAt, acceptedAt, convertedAt, ...rest } = data
  const [row] = await db
    .insert(offers)
    .values({
      ...rest,
      sentAt: normalizeTimestamp(sentAt),
      acceptedAt: normalizeTimestamp(acceptedAt),
      convertedAt: normalizeTimestamp(convertedAt),
    })
    .returning()
  return row ?? null
}

export async function createOfferBundle(db: PostgresJsDatabase, input: CreateOfferBundleInput) {
  return db.transaction(async (tx) => {
    const derivedContact = pickPrimaryContactSnapshot(input.offer, input.contactAssignments ?? [])
    const offer = await createOffer(tx as PostgresJsDatabase, {
      ...derivedContact,
      ...input.offer,
    })
    if (!offer) return null

    const travelers = [] as NonNullable<Awaited<ReturnType<typeof createOfferTraveler>>>[]
    const travelerIndexByInputIndex = new Map<number, number>()
    const staffInputByIndex = new Map<
      number,
      NonNullable<CreateOfferBundleInput["travelers"]>[number]
    >()

    ;(input.travelers ?? []).forEach((traveler, index) => {
      if (isStaffParticipantType(traveler.participantType)) {
        staffInputByIndex.set(index, traveler)
        return
      }

      travelerIndexByInputIndex.set(index, travelers.length)
    })

    for (const [index, traveler] of (input.travelers ?? []).entries()) {
      if (staffInputByIndex.has(index)) {
        continue
      }

      const created = await createOfferTraveler(tx as PostgresJsDatabase, {
        ...traveler,
        offerId: offer.id,
      })
      if (!created) throw new Error("Failed to create offer traveler")
      travelers.push(created)
    }

    const items = [] as NonNullable<Awaited<ReturnType<typeof createOfferItem>>>[]
    for (const item of input.items) {
      const created = await createOfferItem(tx as PostgresJsDatabase, {
        ...item,
        offerId: offer.id,
      })
      if (!created) throw new Error("Failed to create offer item")
      items.push(created)
    }

    const itemTravelers = [] as NonNullable<Awaited<ReturnType<typeof createOfferItemTraveler>>>[]
    const contactAssignments = [] as Array<typeof offerContactAssignments.$inferSelect>
    const staffAssignments = [] as Array<typeof offerStaffAssignments.$inferSelect>
    const linkedStaffInputIndexes = new Set<number>()

    for (const link of input.itemTravelers ?? []) {
      const item = items[link.itemIndex]
      if (!item) throw new Error("Invalid offer item traveler link")

      const travelerIndex = travelerIndexByInputIndex.get(link.participantIndex)
      if (travelerIndex !== undefined) {
        const traveler = travelers[travelerIndex]
        if (!traveler) throw new Error("Invalid offer item traveler link")
        const created = await createOfferItemTraveler(tx as PostgresJsDatabase, {
          offerItemId: item.id,
          travelerId: traveler.id,
          role: link.role,
          isPrimary: link.isPrimary,
        })
        if (!created) throw new Error("Failed to create offer item traveler")
        itemTravelers.push(created)
        continue
      }

      const staffInput = staffInputByIndex.get(link.participantIndex)
      if (!staffInput) {
        throw new Error("Invalid offer item traveler link")
      }

      linkedStaffInputIndexes.add(link.participantIndex)
      const [createdAssignment] = await tx
        .insert(offerStaffAssignments)
        .values({
          offerId: offer.id,
          offerItemId: item.id,
          personId: staffInput.personId ?? null,
          role: toStaffAssignmentRole(link.role),
          firstName: staffInput.firstName,
          lastName: staffInput.lastName,
          email: staffInput.email ?? null,
          phone: staffInput.phone ?? null,
          preferredLanguage: staffInput.preferredLanguage ?? null,
          isPrimary: Boolean(link.isPrimary || staffInput.isPrimary),
          notes: staffInput.notes ?? null,
          metadata: {
            sourceParticipantType: staffInput.participantType,
          },
        })
        .returning()

      if (!createdAssignment) {
        throw new Error("Failed to create offer staff assignment")
      }

      staffAssignments.push(createdAssignment)
    }

    for (const contactInput of input.contactAssignments ?? []) {
      const offerItemId =
        contactInput.itemIndex !== undefined && contactInput.itemIndex !== null
          ? (items[contactInput.itemIndex]?.id ?? null)
          : null
      if (contactInput.itemIndex !== undefined && contactInput.itemIndex !== null && !offerItemId) {
        throw new Error("Invalid offer contact assignment link")
      }
      const [createdAssignment] = await tx
        .insert(offerContactAssignments)
        .values({
          offerId: offer.id,
          offerItemId,
          personId: contactInput.personId ?? null,
          role: contactInput.role,
          firstName: contactInput.firstName,
          lastName: contactInput.lastName,
          email: contactInput.email ?? null,
          phone: contactInput.phone ?? null,
          preferredLanguage: contactInput.preferredLanguage ?? null,
          isPrimary: Boolean(contactInput.isPrimary),
          notes: contactInput.notes ?? null,
          metadata: contactInput.metadata ?? null,
        })
        .returning()

      if (!createdAssignment) {
        throw new Error("Failed to create offer contact assignment")
      }

      contactAssignments.push(createdAssignment)
    }

    for (const [inputIndex, staffInput] of staffInputByIndex.entries()) {
      if (linkedStaffInputIndexes.has(inputIndex)) {
        continue
      }

      const [createdAssignment] = await tx
        .insert(offerStaffAssignments)
        .values({
          offerId: offer.id,
          offerItemId: null,
          personId: staffInput.personId ?? null,
          role: "service_assignee",
          firstName: staffInput.firstName,
          lastName: staffInput.lastName,
          email: staffInput.email ?? null,
          phone: staffInput.phone ?? null,
          preferredLanguage: staffInput.preferredLanguage ?? null,
          isPrimary: Boolean(staffInput.isPrimary),
          notes: staffInput.notes ?? null,
          metadata: {
            sourceParticipantType: staffInput.participantType,
          },
        })
        .returning()

      if (!createdAssignment) {
        throw new Error("Failed to create offer staff assignment")
      }

      staffAssignments.push(createdAssignment)
    }

    return { offer, travelers, contactAssignments, staffAssignments, items, itemTravelers }
  })
}

export async function updateOffer(db: PostgresJsDatabase, id: string, data: UpdateOfferInput) {
  const { sentAt, acceptedAt, convertedAt, ...rest } = data
  const [row] = await db
    .update(offers)
    .set({
      ...rest,
      sentAt: normalizeTimestamp(sentAt),
      acceptedAt: normalizeTimestamp(acceptedAt),
      convertedAt: normalizeTimestamp(convertedAt),
      updatedAt: new Date(),
    })
    .where(eq(offers.id, id))
    .returning()
  return row ?? null
}

export async function deleteOffer(db: PostgresJsDatabase, id: string) {
  const [row] = await db.delete(offers).where(eq(offers.id, id)).returning({ id: offers.id })
  return row ?? null
}

export async function listOfferTravelers(db: PostgresJsDatabase, query: OfferTravelerListQuery) {
  const conditions = []
  if (query.offerId) conditions.push(eq(offerParticipants.offerId, query.offerId))
  if (query.personId) conditions.push(eq(offerParticipants.personId, query.personId))
  const where = conditions.length ? and(...conditions) : undefined
  const rows = db
    .select()
    .from(offerParticipants)
    .where(where)
    .limit(query.limit)
    .offset(query.offset)
    .orderBy(asc(offerParticipants.createdAt))
    .then((items) => items.map(toOfferTravelerResponse))
  return paginate(
    rows,
    db.select({ count: sql<number>`count(*)::int` }).from(offerParticipants).where(where),
    query.limit,
    query.offset,
  )
}
export const listOfferParticipants = listOfferTravelers

export async function getOfferTravelerById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(offerParticipants)
    .where(eq(offerParticipants.id, id))
    .limit(1)
  return row ? toOfferTravelerResponse(row) : null
}
export const getOfferParticipantById = getOfferTravelerById

export async function createOfferTraveler(db: PostgresJsDatabase, data: CreateOfferTravelerInput) {
  const { dateOfBirth, nationality, ...rest } = data
  void dateOfBirth
  void nationality
  const [row] = await db.insert(offerParticipants).values(rest).returning()
  return row ? toOfferTravelerResponse(row) : null
}
export const createOfferParticipant = createOfferTraveler

export async function updateOfferTraveler(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferTravelerInput,
) {
  const { dateOfBirth, nationality, ...rest } = data
  void dateOfBirth
  void nationality
  const [row] = await db
    .update(offerParticipants)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(offerParticipants.id, id))
    .returning()
  return row ? toOfferTravelerResponse(row) : null
}
export const updateOfferParticipant = updateOfferTraveler

export async function deleteOfferTraveler(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerParticipants)
    .where(eq(offerParticipants.id, id))
    .returning({ id: offerParticipants.id })
  return row ?? null
}
export const deleteOfferParticipant = deleteOfferTraveler

export async function listOfferContactAssignments(
  db: PostgresJsDatabase,
  query: OfferContactAssignmentListQuery,
) {
  const conditions = []
  if (query.offerId) conditions.push(eq(offerContactAssignments.offerId, query.offerId))
  if (query.offerItemId) conditions.push(eq(offerContactAssignments.offerItemId, query.offerItemId))
  if (query.personId) conditions.push(eq(offerContactAssignments.personId, query.personId))
  if (query.role) conditions.push(eq(offerContactAssignments.role, query.role))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(offerContactAssignments)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(offerContactAssignments.createdAt))
      .then((items) => items.map(toOfferContactAssignmentResponse)),
    db.select({ count: sql<number>`count(*)::int` }).from(offerContactAssignments).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOfferContactAssignmentById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(offerContactAssignments)
    .where(eq(offerContactAssignments.id, id))
    .limit(1)
  return row ? toOfferContactAssignmentResponse(row) : null
}

export async function createOfferContactAssignment(
  db: PostgresJsDatabase,
  data: CreateOfferContactAssignmentInput,
) {
  const [row] = await db.insert(offerContactAssignments).values(data).returning()
  return row ? toOfferContactAssignmentResponse(row) : null
}

export async function updateOfferContactAssignment(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferContactAssignmentInput,
) {
  const [row] = await db
    .update(offerContactAssignments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(offerContactAssignments.id, id))
    .returning()
  return row ? toOfferContactAssignmentResponse(row) : null
}

export async function deleteOfferContactAssignment(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerContactAssignments)
    .where(eq(offerContactAssignments.id, id))
    .returning({ id: offerContactAssignments.id })
  return row ?? null
}

export async function listOfferStaffAssignments(
  db: PostgresJsDatabase,
  query: OfferStaffAssignmentListQuery,
) {
  const conditions = []
  if (query.offerId) conditions.push(eq(offerStaffAssignments.offerId, query.offerId))
  if (query.offerItemId) conditions.push(eq(offerStaffAssignments.offerItemId, query.offerItemId))
  if (query.personId) conditions.push(eq(offerStaffAssignments.personId, query.personId))
  if (query.role) conditions.push(eq(offerStaffAssignments.role, query.role))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(offerStaffAssignments)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(offerStaffAssignments.createdAt))
      .then((items) => items.map(toOfferStaffAssignmentResponse)),
    db.select({ count: sql<number>`count(*)::int` }).from(offerStaffAssignments).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOfferStaffAssignmentById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(offerStaffAssignments)
    .where(eq(offerStaffAssignments.id, id))
    .limit(1)
  return row ? toOfferStaffAssignmentResponse(row) : null
}

export async function createOfferStaffAssignment(
  db: PostgresJsDatabase,
  data: CreateOfferStaffAssignmentInput,
) {
  const [row] = await db.insert(offerStaffAssignments).values(data).returning()
  return row ? toOfferStaffAssignmentResponse(row) : null
}

export async function updateOfferStaffAssignment(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferStaffAssignmentInput,
) {
  const [row] = await db
    .update(offerStaffAssignments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(offerStaffAssignments.id, id))
    .returning()
  return row ? toOfferStaffAssignmentResponse(row) : null
}

export async function deleteOfferStaffAssignment(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerStaffAssignments)
    .where(eq(offerStaffAssignments.id, id))
    .returning({ id: offerStaffAssignments.id })
  return row ?? null
}

export async function listOfferItems(db: PostgresJsDatabase, query: OfferItemListQuery) {
  const conditions = []
  if (query.offerId) conditions.push(eq(offerItems.offerId, query.offerId))
  if (query.productId) conditions.push(eq(offerItems.productId, query.productId))
  if (query.optionId) conditions.push(eq(offerItems.optionId, query.optionId))
  if (query.unitId) conditions.push(eq(offerItems.unitId, query.unitId))
  if (query.slotId) conditions.push(eq(offerItems.slotId, query.slotId))
  if (query.status) conditions.push(eq(offerItems.status, query.status))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(offerItems)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(offerItems.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(offerItems).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOfferItemById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(offerItems).where(eq(offerItems.id, id)).limit(1)
  return row ?? null
}

export async function createOfferItem(db: PostgresJsDatabase, data: CreateOfferItemInput) {
  const { startsAt, endsAt, ...rest } = data
  const [row] = await db
    .insert(offerItems)
    .values({
      ...rest,
      startsAt: normalizeTimestamp(startsAt),
      endsAt: normalizeTimestamp(endsAt),
    })
    .returning()
  return row ?? null
}

export async function updateOfferItem(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferItemInput,
) {
  const { startsAt, endsAt, ...rest } = data
  const [row] = await db
    .update(offerItems)
    .set({
      ...rest,
      startsAt: normalizeTimestamp(startsAt),
      endsAt: normalizeTimestamp(endsAt),
      updatedAt: new Date(),
    })
    .where(eq(offerItems.id, id))
    .returning()
  return row ?? null
}

export async function deleteOfferItem(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerItems)
    .where(eq(offerItems.id, id))
    .returning({ id: offerItems.id })
  return row ?? null
}

export async function listOfferItemTravelers(
  db: PostgresJsDatabase,
  query: OfferItemTravelerListQuery,
) {
  const conditions = []
  if (query.offerItemId) conditions.push(eq(offerItemParticipants.offerItemId, query.offerItemId))
  if (query.travelerId) conditions.push(eq(offerItemParticipants.travelerId, query.travelerId))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(offerItemParticipants)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(offerItemParticipants.createdAt))
      .then((items) => items.map(toOfferItemTravelerResponse)),
    db.select({ count: sql<number>`count(*)::int` }).from(offerItemParticipants).where(where),
    query.limit,
    query.offset,
  )
}
export const listOfferItemParticipants = listOfferItemTravelers

export async function getOfferItemTravelerById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(offerItemParticipants)
    .where(eq(offerItemParticipants.id, id))
    .limit(1)
  return row ? toOfferItemTravelerResponse(row) : null
}
export const getOfferItemParticipantById = getOfferItemTravelerById

export async function createOfferItemTraveler(
  db: PostgresJsDatabase,
  data: CreateOfferItemTravelerInput,
) {
  const [row] = await db.insert(offerItemParticipants).values(data).returning()
  return row ? toOfferItemTravelerResponse(row) : null
}
export const createOfferItemParticipant = createOfferItemTraveler

export async function updateOfferItemTraveler(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOfferItemTravelerInput,
) {
  const [row] = await db
    .update(offerItemParticipants)
    .set(data)
    .where(eq(offerItemParticipants.id, id))
    .returning()
  return row ? toOfferItemTravelerResponse(row) : null
}
export const updateOfferItemParticipant = updateOfferItemTraveler

export async function deleteOfferItemTraveler(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(offerItemParticipants)
    .where(eq(offerItemParticipants.id, id))
    .returning({ id: offerItemParticipants.id })
  return row ?? null
}
export const deleteOfferItemParticipant = deleteOfferItemTraveler
