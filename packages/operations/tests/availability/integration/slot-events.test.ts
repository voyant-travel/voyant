import { availabilitySlots } from "@voyant-travel/availability/schema"
import { createEventBus } from "@voyant-travel/core"
import { newId } from "@voyant-travel/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyant-travel/db/test-utils"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { products } from "../../../../inventory/src/schema.js"
import {
  AVAILABILITY_SLOT_CHANGED_EVENT,
  type AvailabilitySlotChangedEvent,
} from "../../../src/availability/events.js"
import {
  createSlot,
  deleteSlot,
  getSlotById,
  updateSlot,
} from "../../../src/availability/service-core.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("availability slot events", () => {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle test client -- owner: availability; existing suppression is intentional pending typed cleanup.
  let db: any
  let productId: string

  beforeAll(() => {
    db = createTestDb()
  })

  beforeEach(async () => {
    await cleanupTestDb(db)
    productId = newId("products")
    await db.insert(products).values({
      id: productId,
      name: "Slot Event Test Product",
      sellCurrency: "USD",
      bookingMode: "date",
    })
  })

  function recordingBus() {
    const bus = createEventBus()
    const events: Array<{ event: string; data: AvailabilitySlotChangedEvent }> = []
    bus.subscribe<AvailabilitySlotChangedEvent>(AVAILABILITY_SLOT_CHANGED_EVENT, ({ data }) => {
      events.push({ event: AVAILABILITY_SLOT_CHANGED_EVENT, data })
    })
    return { bus, events }
  }

  it("createSlot emits availability.slot.changed with source='created'", async () => {
    const { bus, events } = recordingBus()
    const created = await createSlot(
      db,
      {
        productId,
        dateLocal: "2026-06-01",
        startsAt: "2026-06-01T08:00:00Z",
        timezone: "UTC",
        status: "open",
        unlimited: false,
        remainingPax: 5,
      },
      { eventBus: bus },
    )
    expect(created).toBeDefined()
    expect(events).toHaveLength(1)
    expect(events[0]?.data.source).toBe("created")
    expect(events[0]?.data.productId).toBe(productId)
    expect(events[0]?.data.remainingPax).toBe(5)
  })

  it("deleteSlot emits availability.slot.changed with source='deleted'", async () => {
    // Seed a slot directly so we can isolate the delete event.
    const slotId = newId("availability_slots")
    await db.insert(availabilitySlots).values({
      id: slotId,
      productId,
      dateLocal: "2026-06-01",
      startsAt: new Date("2026-06-01T08:00:00Z"),
      timezone: "UTC",
      status: "open",
      unlimited: false,
      remainingPax: 5,
    })

    const { bus, events } = recordingBus()
    const deleted = await deleteSlot(db, slotId, { eventBus: bus })
    expect(deleted).toBeDefined()
    expect(events).toHaveLength(1)
    expect(events[0]?.data.source).toBe("deleted")
    expect(events[0]?.data.productId).toBe(productId)
    // Deleted slot reports zero remaining capacity per the contract.
    expect(events[0]?.data.remainingPax).toBe(0)
  })

  it("deleteSlot is a no-op (no event) when the slot doesn't exist", async () => {
    const { bus, events } = recordingBus()
    const result = await deleteSlot(db, "availability_slots_nonexistent", { eventBus: bus })
    expect(result).toBeNull()
    expect(events).toHaveLength(0)
  })

  it("updateSlot still emits with default source='manual' (back-compat)", async () => {
    const slotId = newId("availability_slots")
    await db.insert(availabilitySlots).values({
      id: slotId,
      productId,
      dateLocal: "2026-06-01",
      startsAt: new Date("2026-06-01T08:00:00Z"),
      timezone: "UTC",
      status: "open",
      unlimited: false,
      remainingPax: 5,
    })

    const { bus, events } = recordingBus()
    await updateSlot(db, slotId, { remainingPax: 3 }, { eventBus: bus })
    expect(events).toHaveLength(1)
    expect(events[0]?.data.source).toBe("manual")
  })

  it("rejects a product ownership move without emitting a misleading new-product event", async () => {
    const slotId = newId("availability_slots")
    const otherProductId = newId("products")
    await db.insert(products).values({
      id: otherProductId,
      name: "Other Slot Event Product",
      sellCurrency: "USD",
      bookingMode: "date",
    })
    await db.insert(availabilitySlots).values({
      id: slotId,
      productId,
      dateLocal: "2026-06-01",
      startsAt: new Date("2026-06-01T08:00:00Z"),
      timezone: "UTC",
      status: "open",
      unlimited: false,
      remainingPax: 5,
    })

    const { bus, events } = recordingBus()
    await expect(
      updateSlot(db, slotId, { productId: otherProductId }, { eventBus: bus }),
    ).rejects.toThrow("product ownership is immutable")
    expect(events).toHaveLength(0)
    expect(await getSlotById(db, slotId)).toMatchObject({ productId })
  })

  it("accepts an unchanged full snapshot without losing remaining or cutoff compatibility fields", async () => {
    const slotId = newId("availability_slots")
    await db.insert(availabilitySlots).values({
      id: slotId,
      productId,
      dateLocal: "2026-06-01",
      startsAt: new Date("2026-06-01T08:00:00Z"),
      timezone: "UTC",
      status: "open",
      unlimited: false,
      initialPax: 8,
      remainingPax: 5,
      initialPickups: 4,
      remainingPickups: 3,
      remainingResources: 2,
      pastCutoff: false,
      tooEarly: false,
      nights: 1,
      days: 2,
      notes: "Original note",
    })
    const current = await getSlotById(db, slotId)
    if (!current) throw new Error("compatibility test slot disappeared")

    const updated = await updateSlot(db, slotId, {
      productId: current.productId,
      itineraryId: current.itineraryId,
      optionId: current.optionId,
      facilityId: current.facilityId,
      availabilityRuleId: current.availabilityRuleId,
      startTimeId: current.startTimeId,
      dateLocal: current.dateLocal,
      startsAt: current.startsAt.toISOString(),
      endsAt: current.endsAt?.toISOString() ?? null,
      timezone: current.timezone,
      status: current.status,
      unlimited: current.unlimited,
      initialPax: current.initialPax,
      remainingPax: current.remainingPax,
      initialPickups: current.initialPickups,
      remainingPickups: current.remainingPickups,
      remainingResources: current.remainingResources,
      pastCutoff: current.pastCutoff,
      tooEarly: current.tooEarly,
      nights: current.nights,
      days: current.days,
      notes: "Updated through a full snapshot",
    })

    expect(updated).toMatchObject({
      id: slotId,
      productId,
      remainingPax: 5,
      remainingPickups: 3,
      remainingResources: 2,
      pastCutoff: false,
      tooEarly: false,
      notes: "Updated through a full snapshot",
    })
  })
})
