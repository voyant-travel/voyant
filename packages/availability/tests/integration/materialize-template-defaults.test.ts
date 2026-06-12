import { newId } from "@voyantjs/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { productOptions, products } from "@voyantjs/products/schema"
import { eq, sql } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { generateAvailabilitySlots } from "../../src/generate-slots.js"
import {
  availabilityRules,
  availabilitySlots,
  productOptionResourceTemplates,
} from "../../src/schema.js"
import { materializeSlotResourcesFromTemplateDefaults } from "../../src/service-allocation-automation.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("materialize template defaults (integration)", () => {
  // biome-ignore lint/suspicious/noExplicitAny: owner: availability; createTestDb returns a driver-specific drizzle test client
  let db: any
  let productId: string
  let optionId: string

  beforeAll(() => {
    db = createTestDb()
  })

  beforeEach(async () => {
    await cleanupTestDb(db)
    productId = newId("products")
    optionId = newId("product_options")
    await db.insert(products).values({
      id: productId,
      name: "Romanian Circuit",
      sellCurrency: "EUR",
      bookingMode: "date",
    })
    await db.insert(productOptions).values({
      id: optionId,
      productId,
      name: "Standard Circuit",
      status: "active",
      sortOrder: 0,
    })
  })

  it("seeds resources per template default_count on slot create", async () => {
    // Unique index on (product_option_id, kind) — model rooming as two
    // distinct kinds ("room_sgl", "room_dbl") so we can express both
    // buckets at the catalog level.
    await db.insert(productOptionResourceTemplates).values([
      {
        productOptionId: optionId,
        kind: "room_sgl",
        capacity: 1,
        namePattern: "SGL {sequence}",
        defaultCount: 5,
        flags: { roomType: "SGL" },
      },
      {
        productOptionId: optionId,
        kind: "room_dbl",
        capacity: 2,
        namePattern: "DBL {sequence}",
        defaultCount: 20,
        flags: { roomType: "DBL" },
      },
    ])

    const slotId = newId("availability_slots")
    await db.insert(availabilitySlots).values({
      id: slotId,
      productId,
      optionId,
      dateLocal: "2026-06-01",
      startsAt: new Date("2026-06-01T08:00:00Z"),
      timezone: "UTC",
      status: "open",
      unlimited: false,
      initialPax: 49,
      remainingPax: 49,
    })

    const result = await materializeSlotResourcesFromTemplateDefaults(db, slotId)
    expect(result.created).toBe(25)
    const rooms = await db.execute(sql`
      SELECT label, capacity, kind FROM allocation_resources WHERE slot_id = ${slotId} ORDER BY sort_order
    `)
    const rows = rooms as Array<{ label: string; capacity: number; kind: string }>
    expect(rows.filter((r) => r.kind === "room_sgl")).toHaveLength(5)
    expect(rows.filter((r) => r.kind === "room_dbl")).toHaveLength(20)
  })

  it("skips templates with null default_count (manual seeding only)", async () => {
    await db.insert(productOptionResourceTemplates).values({
      productOptionId: optionId,
      kind: "room",
      capacity: 1,
      namePattern: "SGL {sequence}",
      defaultCount: null,
    })

    const slotId = newId("availability_slots")
    await db.insert(availabilitySlots).values({
      id: slotId,
      productId,
      optionId,
      dateLocal: "2026-06-01",
      startsAt: new Date("2026-06-01T08:00:00Z"),
      timezone: "UTC",
      status: "open",
      unlimited: false,
      initialPax: 5,
      remainingPax: 5,
    })

    const result = await materializeSlotResourcesFromTemplateDefaults(db, slotId)
    expect(result.created).toBe(0)
  })

  it("auto-materializes during generateAvailabilitySlots", async () => {
    await db.insert(productOptionResourceTemplates).values({
      productOptionId: optionId,
      kind: "room",
      capacity: 2,
      namePattern: "DBL {sequence}",
      defaultCount: 3,
    })
    await db.insert(availabilityRules).values({
      id: newId("availability_rules"),
      productId,
      optionId,
      timezone: "UTC",
      recurrenceRule: "FREQ=DAILY;COUNT=1",
      maxCapacity: 6,
      active: true,
    })

    const result = await generateAvailabilitySlots(db, {
      horizonDays: 2,
      now: new Date("2026-06-01T00:00:00Z"),
    })
    expect(result.slotsCreated).toBeGreaterThan(0)
    expect(result.resourcesMaterialized).toBeGreaterThanOrEqual(3)
  })

  it("generates startsAt as a true UTC instant in the rule timezone", async () => {
    const ruleId = newId("availability_rules")
    await db.insert(availabilityRules).values({
      id: ruleId,
      productId,
      optionId,
      timezone: "Europe/Bucharest",
      recurrenceRule: "FREQ=DAILY;COUNT=1",
      maxCapacity: 6,
      active: true,
    })

    await generateAvailabilitySlots(db, {
      horizonDays: 2,
      defaultStartTime: "09:00",
      now: new Date("2026-09-26T00:00:00Z"),
      materializeResources: false,
    })

    const [slot] = await db
      .select()
      .from(availabilitySlots)
      .where(eq(availabilitySlots.availabilityRuleId, ruleId))
      .limit(1)

    expect(slot?.dateLocal).toBe("2026-09-26")
    expect(slot?.startsAt.toISOString()).toBe("2026-09-26T06:00:00.000Z")
  })
})
