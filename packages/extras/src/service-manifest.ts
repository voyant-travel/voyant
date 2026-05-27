import { newId } from "@voyantjs/db/lib/typeid"
import { and, asc, desc, eq, inArray, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import {
  availabilitySlotsRef,
  bookingAllocationsRef,
  bookingItemsRef,
  bookingItemTravelersRef,
  bookingsRef,
  bookingTravelersRef,
} from "./booking-availability-ref.js"
import { extraParticipantSelections, productExtras } from "./schema.js"
import type {
  slotExtraCollectionBulkSchema,
  slotExtraManifestQuerySchema,
  slotExtraSelectionBulkSchema,
  slotExtraSelectionPatchSchema,
} from "./validation.js"

type SlotExtraManifestQuery = z.infer<typeof slotExtraManifestQuerySchema>
type SlotExtraSelectionPatch = z.infer<typeof slotExtraSelectionPatchSchema>
type SlotExtraSelectionBulk = z.infer<typeof slotExtraSelectionBulkSchema>
type SlotExtraCollectionBulk = z.infer<typeof slotExtraCollectionBulkSchema>

const activeBookingStatusesForSlot = [
  "on_hold",
  "awaiting_payment",
  "confirmed",
  "in_progress",
  "completed",
] as const

const activeAllocationStatusesForSlot = ["held", "confirmed", "fulfilled"] as const

function defaultCollectionStatus(collectionMode: string) {
  if (collectionMode === "cash_on_trip" || collectionMode === "external") return "pending"
  return "not_required"
}

function selectionKey(travelerId: string, productExtraId: string) {
  return `${travelerId}:${productExtraId}`
}

function fullName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ").trim()
}

function metadataProductExtraId(metadata: Record<string, unknown> | null | undefined) {
  return typeof metadata?.productExtraId === "string" ? metadata.productExtraId : null
}

export const extrasManifestService = {
  async getSlotExtraManifest(
    db: PostgresJsDatabase,
    slotId: string,
    query: SlotExtraManifestQuery = { includeInactiveExtras: false },
  ) {
    const [slot] = await db
      .select()
      .from(availabilitySlotsRef)
      .where(eq(availabilitySlotsRef.id, slotId))
      .limit(1)

    if (!slot) return { status: "slot_not_found" as const }

    const extraConditions = [eq(productExtras.productId, slot.productId)]
    if (!query.includeInactiveExtras) {
      extraConditions.push(eq(productExtras.active, true))
      extraConditions.push(eq(productExtras.showOnSlotManifest, true))
    }

    const [extras, travelers] = await Promise.all([
      db
        .select()
        .from(productExtras)
        .where(and(...extraConditions))
        .orderBy(asc(productExtras.sortOrder), asc(productExtras.name)),
      db
        .selectDistinct({
          id: bookingTravelersRef.id,
          bookingId: bookingTravelersRef.bookingId,
          bookingNumber: bookingsRef.bookingNumber,
          bookingStatus: bookingsRef.status,
          participantType: bookingTravelersRef.participantType,
          travelerCategory: bookingTravelersRef.travelerCategory,
          firstName: bookingTravelersRef.firstName,
          lastName: bookingTravelersRef.lastName,
          email: bookingTravelersRef.email,
          phone: bookingTravelersRef.phone,
          isPrimary: bookingTravelersRef.isPrimary,
          createdAt: bookingTravelersRef.createdAt,
        })
        .from(bookingTravelersRef)
        .innerJoin(bookingsRef, eq(bookingsRef.id, bookingTravelersRef.bookingId))
        .innerJoin(bookingAllocationsRef, eq(bookingAllocationsRef.bookingId, bookingsRef.id))
        .where(
          and(
            eq(bookingAllocationsRef.availabilitySlotId, slotId),
            inArray(bookingsRef.status, [...activeBookingStatusesForSlot]),
            inArray(bookingAllocationsRef.status, [...activeAllocationStatusesForSlot]),
            or(
              eq(bookingTravelersRef.participantType, "traveler"),
              eq(bookingTravelersRef.participantType, "occupant"),
            ),
          ),
        )
        .orderBy(
          asc(bookingsRef.bookingNumber),
          desc(bookingTravelersRef.isPrimary),
          asc(bookingTravelersRef.createdAt),
        ),
    ])

    const bookingIds = [...new Set(travelers.map((traveler) => traveler.bookingId))]
    const productExtraIds = extras.map((extra) => extra.id)
    const productExtraIdSet = new Set(productExtraIds)

    const [rawExtraItems, persistedSelections] =
      bookingIds.length > 0 && productExtraIds.length > 0
        ? await Promise.all([
            db
              .select()
              .from(bookingItemsRef)
              .where(
                and(
                  inArray(bookingItemsRef.bookingId, bookingIds),
                  eq(bookingItemsRef.itemType, "extra"),
                ),
              ),
            db
              .select()
              .from(extraParticipantSelections)
              .where(
                and(
                  inArray(extraParticipantSelections.bookingId, bookingIds),
                  inArray(extraParticipantSelections.productExtraId, productExtraIds),
                ),
              ),
          ])
        : [[], []]

    const extraItems = rawExtraItems.filter((item) =>
      productExtraIdSet.has(metadataProductExtraId(item.metadata) ?? ""),
    )
    const itemIds = extraItems.map((item) => item.id)
    const itemLinks =
      itemIds.length > 0
        ? await db
            .select()
            .from(bookingItemTravelersRef)
            .where(inArray(bookingItemTravelersRef.bookingItemId, itemIds))
        : []

    const itemById = new Map(extraItems.map((item) => [item.id, item]))
    const itemSelectionsByKey = new Map<
      string,
      {
        bookingItemId: string
        quantity: number
        unitSellAmountCents: number | null
        totalSellAmountCents: number | null
        sellCurrency: string
      }
    >()

    for (const link of itemLinks) {
      const item = itemById.get(link.bookingItemId)
      const productExtraId = metadataProductExtraId(item?.metadata)
      if (!item || !productExtraId) continue
      itemSelectionsByKey.set(selectionKey(link.travelerId, productExtraId), {
        bookingItemId: item.id,
        quantity: item.quantity,
        unitSellAmountCents: item.unitSellAmountCents,
        totalSellAmountCents: item.totalSellAmountCents,
        sellCurrency: item.sellCurrency,
      })
    }

    const persistedByKey = new Map(
      persistedSelections.map((selection) => [
        selectionKey(selection.travelerId, selection.productExtraId),
        selection,
      ]),
    )

    return {
      status: "ok" as const,
      data: {
        slot,
        extras,
        travelers: travelers.map((traveler) => ({
          ...traveler,
          fullName: fullName(traveler.firstName, traveler.lastName),
        })),
        selections: travelers.flatMap((traveler) =>
          extras.map((extra) => {
            const key = selectionKey(traveler.id, extra.id)
            const persisted = persistedByKey.get(key)
            const itemSelection = itemSelectionsByKey.get(key)
            const status = persisted?.status ?? (itemSelection ? "selected" : "cancelled")
            const collectionMode = persisted?.collectionMode ?? extra.collectionMode
            return {
              bookingId: traveler.bookingId,
              travelerId: traveler.id,
              productExtraId: extra.id,
              optionExtraConfigId: persisted?.optionExtraConfigId ?? null,
              bookingItemId: persisted?.bookingItemId ?? itemSelection?.bookingItemId ?? null,
              status,
              selected: status === "selected" || status === "fulfilled",
              collectionMode,
              collectionStatus:
                persisted?.collectionStatus ?? defaultCollectionStatus(collectionMode),
              collectionCurrency:
                persisted?.collectionCurrency ?? itemSelection?.sellCurrency ?? null,
              collectionAmountCents:
                persisted?.collectionAmountCents ?? itemSelection?.totalSellAmountCents ?? null,
              collectedAt: persisted?.collectedAt ?? null,
              collectedBy: persisted?.collectedBy ?? null,
              notes: persisted?.notes ?? null,
              metadata: persisted?.metadata ?? null,
              source: persisted ? "selection" : itemSelection ? "booking_item" : "empty",
            }
          }),
        ),
      },
    }
  },

  async setSlotExtraSelection(
    db: PostgresJsDatabase,
    slotId: string,
    input: SlotExtraSelectionPatch,
    actorId?: string,
  ) {
    const validation = await validateSlotSelection(db, slotId, input)
    if (validation.status !== "ok") return validation

    const existingItem = await findBookingExtraItem(
      db,
      input.bookingId,
      input.travelerId,
      input.productExtraId,
    )
    const collectionMode = validation.extra.collectionMode
    const bookingItemId =
      existingItem?.bookingItemId ??
      (collectionMode === "booking_total" && input.status !== "cancelled"
        ? await createBookingTotalExtraItem(db, {
            bookingId: input.bookingId,
            travelerId: input.travelerId,
            productId: validation.slot.productId,
            optionId: validation.slot.optionId,
            extra: validation.extra,
            optionExtraConfigId: input.optionExtraConfigId ?? null,
            sellCurrency: input.collectionCurrency ?? validation.booking.sellCurrency,
            unitSellAmountCents: input.collectionAmountCents ?? null,
            totalSellAmountCents: input.collectionAmountCents ?? null,
            slotId,
          })
        : null)
    const collectionStatus =
      input.collectionStatus ??
      (input.status === "cancelled" ? "not_required" : defaultCollectionStatus(collectionMode))
    const collectedAt = collectionStatus === "collected" ? new Date() : null

    const [row] = await db
      .insert(extraParticipantSelections)
      .values({
        bookingId: input.bookingId,
        bookingItemId,
        travelerId: input.travelerId,
        productExtraId: input.productExtraId,
        optionExtraConfigId: input.optionExtraConfigId ?? null,
        status: input.status,
        collectionMode,
        collectionStatus,
        collectionCurrency: input.collectionCurrency ?? existingItem?.sellCurrency ?? null,
        collectionAmountCents:
          input.collectionAmountCents ?? existingItem?.totalSellAmountCents ?? null,
        collectedAt,
        collectedBy: collectedAt ? (actorId ?? null) : null,
        notes: input.notes ?? null,
        metadata: input.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [
          extraParticipantSelections.bookingId,
          extraParticipantSelections.travelerId,
          extraParticipantSelections.productExtraId,
        ],
        set: {
          bookingItemId,
          optionExtraConfigId: input.optionExtraConfigId ?? null,
          status: input.status,
          collectionMode,
          collectionStatus,
          collectionCurrency: input.collectionCurrency ?? existingItem?.sellCurrency ?? null,
          collectionAmountCents:
            input.collectionAmountCents ?? existingItem?.totalSellAmountCents ?? null,
          collectedAt,
          collectedBy: collectedAt ? (actorId ?? null) : null,
          notes: input.notes ?? null,
          metadata: input.metadata ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()

    return { status: "ok" as const, data: row ?? null }
  },

  async bulkSetSlotExtraSelections(
    db: PostgresJsDatabase,
    slotId: string,
    input: SlotExtraSelectionBulk,
    actorId?: string,
  ) {
    const rows = []
    for (const selection of input.selections) {
      const result = await this.setSlotExtraSelection(db, slotId, selection, actorId)
      if (result.status !== "ok") return result
      rows.push(result.data)
    }
    return { status: "ok" as const, data: rows }
  },

  async bulkUpdateSlotExtraCollections(
    db: PostgresJsDatabase,
    slotId: string,
    input: SlotExtraCollectionBulk,
    actorId?: string,
  ) {
    const manifest = await this.getSlotExtraManifest(db, slotId)
    if (manifest.status !== "ok") return manifest
    const travelerById = new Map(manifest.data.travelers.map((traveler) => [traveler.id, traveler]))
    const extra = manifest.data.extras.find((candidate) => candidate.id === input.productExtraId)
    if (!extra) return { status: "extra_not_found" as const }

    const rows = []
    for (const travelerId of input.travelerIds) {
      const traveler = travelerById.get(travelerId)
      if (!traveler) return { status: "traveler_not_found" as const }
      const result = await this.setSlotExtraSelection(
        db,
        slotId,
        {
          bookingId: traveler.bookingId,
          travelerId,
          productExtraId: input.productExtraId,
          status: "selected",
          collectionStatus: input.collectionStatus,
          collectionCurrency: input.collectionCurrency,
          collectionAmountCents: input.collectionAmountCents,
          notes: input.notes,
        },
        actorId,
      )
      if (result.status !== "ok") return result
      rows.push(result.data)
    }

    return { status: "ok" as const, data: rows }
  },
}

async function validateSlotSelection(
  db: PostgresJsDatabase,
  slotId: string,
  input: SlotExtraSelectionPatch,
) {
  const [slot] = await db
    .select()
    .from(availabilitySlotsRef)
    .where(eq(availabilitySlotsRef.id, slotId))
    .limit(1)
  if (!slot) return { status: "slot_not_found" as const }

  const [extra] = await db
    .select()
    .from(productExtras)
    .where(
      and(eq(productExtras.id, input.productExtraId), eq(productExtras.productId, slot.productId)),
    )
    .limit(1)
  if (!extra) return { status: "extra_not_found" as const }

  const [traveler] = await db
    .select({ id: bookingTravelersRef.id, sellCurrency: bookingsRef.sellCurrency })
    .from(bookingTravelersRef)
    .innerJoin(bookingsRef, eq(bookingsRef.id, bookingTravelersRef.bookingId))
    .innerJoin(bookingAllocationsRef, eq(bookingAllocationsRef.bookingId, bookingsRef.id))
    .where(
      and(
        eq(bookingTravelersRef.id, input.travelerId),
        eq(bookingTravelersRef.bookingId, input.bookingId),
        eq(bookingAllocationsRef.availabilitySlotId, slotId),
        inArray(bookingsRef.status, [...activeBookingStatusesForSlot]),
        inArray(bookingAllocationsRef.status, [...activeAllocationStatusesForSlot]),
      ),
    )
    .limit(1)
  if (!traveler) return { status: "traveler_not_found" as const }

  return { status: "ok" as const, slot, extra, booking: { sellCurrency: traveler.sellCurrency } }
}

async function findBookingExtraItem(
  db: PostgresJsDatabase,
  bookingId: string,
  travelerId: string,
  productExtraId: string,
) {
  const rows = await db
    .select({
      bookingItemId: bookingItemsRef.id,
      sellCurrency: bookingItemsRef.sellCurrency,
      unitSellAmountCents: bookingItemsRef.unitSellAmountCents,
      totalSellAmountCents: bookingItemsRef.totalSellAmountCents,
      metadata: bookingItemsRef.metadata,
    })
    .from(bookingItemsRef)
    .innerJoin(
      bookingItemTravelersRef,
      eq(bookingItemTravelersRef.bookingItemId, bookingItemsRef.id),
    )
    .where(
      and(
        eq(bookingItemsRef.bookingId, bookingId),
        eq(bookingItemsRef.itemType, "extra"),
        eq(bookingItemTravelersRef.travelerId, travelerId),
      ),
    )

  return rows.find((row) => metadataProductExtraId(row.metadata) === productExtraId) ?? null
}

async function createBookingTotalExtraItem(
  db: PostgresJsDatabase,
  input: {
    bookingId: string
    travelerId: string
    productId: string
    optionId: string | null
    extra: typeof productExtras.$inferSelect
    optionExtraConfigId: string | null
    sellCurrency: string
    unitSellAmountCents: number | null
    totalSellAmountCents: number | null
    slotId: string
  },
) {
  const bookingItemId = newId("booking_items")
  const now = new Date()
  await db.insert(bookingItemsRef).values({
    id: bookingItemId,
    bookingId: input.bookingId,
    title: input.extra.name,
    description: input.extra.description,
    itemType: "extra",
    status: "confirmed",
    quantity: 1,
    sellCurrency: input.sellCurrency,
    unitSellAmountCents: input.unitSellAmountCents,
    totalSellAmountCents: input.totalSellAmountCents,
    productId: input.productId,
    optionId: input.optionId,
    metadata: {
      productExtraId: input.extra.id,
      optionExtraConfigId: input.optionExtraConfigId,
      pricingMode: input.extra.pricingMode,
      pricedPerPerson: input.extra.pricedPerPerson,
      availabilitySlotId: input.slotId,
    },
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(bookingItemTravelersRef).values({
    id: newId("booking_item_travelers"),
    bookingItemId,
    travelerId: input.travelerId,
    role: "traveler",
    isPrimary: false,
  })

  return bookingItemId
}
