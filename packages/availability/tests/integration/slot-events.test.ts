import { createEventBus } from "@voyantjs/core"
import { newId } from "@voyantjs/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { products } from "@voyantjs/products/schema"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  AVAILABILITY_SLOT_CHANGED_EVENT,
  type AvailabilitySlotChangedEvent,
} from "../../src/events.js"
import { availabilitySlots } from "../../src/schema.js"
import { createSlot, deleteSlot, updateSlot } from "../../src/service-core.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("availability slot events", () => {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle test client
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
})
