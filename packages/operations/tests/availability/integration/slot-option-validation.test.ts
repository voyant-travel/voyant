import { availabilitySlots } from "@voyant-travel/availability/schema"
import { newId } from "@voyant-travel/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyant-travel/db/test-utils"
import { RequestValidationError } from "@voyant-travel/hono"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"
import { productOptions, products } from "../../../../inventory/src/schema.js"
import { createSlot, updateSlot } from "../../../src/availability/service-core.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL

const db = DB_AVAILABLE ? createTestDb() : (null as never)

async function seedProduct(name: string) {
  const productId = newId("products")
  await db.insert(products).values({
    id: productId,
    name,
    sellCurrency: "USD",
  })
  return productId
}

async function seedOption(productId: string, name: string) {
  const optionId = newId("product_options")
  await db.insert(productOptions).values({
    id: optionId,
    productId,
    name,
    status: "active",
    isDefault: true,
  })
  return optionId
}

function slotInput(productId: string, overrides: Partial<Parameters<typeof createSlot>[1]> = {}) {
  return {
    productId,
    dateLocal: "2026-09-10",
    startsAt: "2026-09-10T09:00:00.000Z",
    timezone: "Europe/London",
    ...overrides,
  }
}

describe.skipIf(!DB_AVAILABLE)("availability slot option validation", () => {
  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  it("allows product-level slots without an option", async () => {
    const productId = await seedProduct("Product-level trip")

    const slot = await createSlot(db, slotInput(productId))

    expect(slot?.productId).toBe(productId)
    expect(slot?.optionId).toBeNull()
  })

  it("persists an explicit option that belongs to the slot product", async () => {
    const productId = await seedProduct("Priced trip")
    const optionId = await seedOption(productId, "Standard")

    const slot = await createSlot(db, slotInput(productId, { optionId }))

    expect(slot?.optionId).toBe(optionId)
  })

  it("rejects an explicit option from a different product", async () => {
    const productId = await seedProduct("Priced trip")
    const otherProductId = await seedProduct("Other trip")
    const otherOptionId = await seedOption(otherProductId, "Other standard")

    await expect(
      createSlot(db, slotInput(productId, { optionId: otherOptionId })),
    ).rejects.toBeInstanceOf(RequestValidationError)
  })

  it("repairs an existing product-level slot by saving a valid option", async () => {
    const productId = await seedProduct("Repairable trip")
    const optionId = await seedOption(productId, "Standard")
    const slot = await createSlot(db, slotInput(productId))
    if (!slot) throw new Error("failed to create slot")

    const updated = await updateSlot(db, slot.id, { productId, optionId })

    expect(updated?.optionId).toBe(optionId)
    const [stored] = await db
      .select({ optionId: availabilitySlots.optionId })
      .from(availabilitySlots)
      .where(eq(availabilitySlots.id, slot.id))
    expect(stored?.optionId).toBe(optionId)
  })

  it("rejects a product change that would leave the slot option on the wrong product", async () => {
    const productId = await seedProduct("Original trip")
    const optionId = await seedOption(productId, "Standard")
    const otherProductId = await seedProduct("Other trip")
    const slot = await createSlot(db, slotInput(productId, { optionId }))
    if (!slot) throw new Error("failed to create slot")

    await expect(updateSlot(db, slot.id, { productId: otherProductId })).rejects.toBeInstanceOf(
      RequestValidationError,
    )
  })
})
