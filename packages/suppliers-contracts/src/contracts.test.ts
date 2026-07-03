import { describe, expect, it } from "vitest"
import {
  insertContractSchema,
  insertRateSchema,
  insertSupplierSchema,
  updateContractSchema,
  updateRateSchema,
  updateSupplierSchema,
} from "./index.js"

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

  it("rejects reversed supplier rate date and pax ranges", () => {
    const baseRate = {
      name: "Standard",
      currency: "EUR",
      amountCents: 1000,
      unit: "per_person",
    } as const

    expect(
      insertRateSchema.safeParse({
        ...baseRate,
        validFrom: "2026-09-10",
        validTo: "2026-09-01",
      }).success,
    ).toBe(false)
    expect(
      updateRateSchema.safeParse({ validFrom: "2026-09-10", validTo: "2026-09-01" }).success,
    ).toBe(false)
    expect(
      insertRateSchema.safeParse({
        ...baseRate,
        minPax: 8,
        maxPax: 2,
      }).success,
    ).toBe(false)
    expect(updateRateSchema.safeParse({ minPax: 8, maxPax: 2 }).success).toBe(false)
  })

  it("rejects supplier contract term ranges and renewal dates outside the term", () => {
    expect(
      insertContractSchema.safeParse({
        startDate: "2027-06-30",
        endDate: "2026-07-01",
      }).success,
    ).toBe(false)
    expect(
      updateContractSchema.safeParse({ startDate: "2027-06-30", endDate: "2026-07-01" }),
    ).toMatchObject({ success: false })

    expect(
      insertContractSchema.safeParse({
        startDate: "2026-07-01",
        endDate: "2026-12-31",
        renewalDate: "2027-01-01",
      }).success,
    ).toBe(false)
    expect(
      insertContractSchema.safeParse({
        startDate: "2026-07-01",
        endDate: "2026-12-31",
        renewalDate: "2026-06-30",
      }).success,
    ).toBe(false)
  })
})
