import { describe, expect, it } from "vitest"
import { insertRateSchema, insertSupplierSchema, updateSupplierSchema } from "./index.js"

describe("suppliers-contracts", () => {
  it("accepts a valid supplier and rejects an unknown type", () => {
    const parsed = insertSupplierSchema.parse({ name: "Acme Tours", type: "guide" })
    expect(parsed.status).toBe("active")
    expect(insertSupplierSchema.safeParse({ name: "Acme Tours", type: "spaceship" }).success).toBe(
      false,
    )
  })

  it("accepts uppercase 3-letter supplier defaultCurrency", () => {
    const parsed = insertSupplierSchema.parse({
      name: "Acme Tours",
      type: "guide",
      defaultCurrency: "EUR",
    })
    expect(parsed.defaultCurrency).toBe("EUR")
  })

  it("rejects short and lowercase supplier defaultCurrency values", () => {
    expect(
      insertSupplierSchema.safeParse({ name: "Acme Tours", type: "guide", defaultCurrency: "X" })
        .success,
    ).toBe(false)
    expect(
      insertSupplierSchema.safeParse({ name: "Acme Tours", type: "guide", defaultCurrency: "" })
        .success,
    ).toBe(false)
    expect(updateSupplierSchema.safeParse({ defaultCurrency: "usd" }).success).toBe(false)
  })

  it("does not apply insert defaults to supplier update payloads", () => {
    const parsed = updateSupplierSchema.parse({})
    expect(parsed).not.toHaveProperty("status")
    expect(parsed).not.toHaveProperty("tags")
    expect(updateSupplierSchema.parse({ status: "pending", tags: ["preferred"] })).toMatchObject({
      status: "pending",
      tags: ["preferred"],
    })
  })

  it("accepts a valid rate and rejects a non-3-char currency", () => {
    const parsed = insertRateSchema.parse({
      name: "Standard",
      currency: "EUR",
      amountCents: 1000,
      unit: "per_person",
    })
    expect(parsed.unit).toBe("per_person")
    expect(
      insertRateSchema.safeParse({
        name: "Standard",
        currency: "EURO",
        amountCents: 1000,
        unit: "per_person",
      }).success,
    ).toBe(false)
  })
})
