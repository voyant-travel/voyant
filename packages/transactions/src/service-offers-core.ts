import { and, desc, eq, ilike, or, sql } from "drizzle-orm"

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { offerContactAssignments, offerStaffAssignments, offers } from "./schema.js"

import { createOfferItem, createOfferItemTraveler } from "./service-offer-items.js"

import { createOfferTraveler } from "./service-offer-participants.js"

import type {
  CreateOfferBundleInput,
  CreateOfferInput,
  OfferListQuery,
  UpdateOfferInput,
} from "./service-shared.js"

import { normalizeTimestamp, paginate } from "./service-shared.js"

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
