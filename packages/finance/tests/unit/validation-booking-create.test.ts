import { describe, expect, it } from "vitest"

import { bookingCreateSchema } from "../../src/service-booking-create.js"

describe("bookingCreateSchema", () => {
  const valid = {
    productId: "prod_123",
    bookingNumber: "BK-001",
  }

  it("accepts a confirmed catalog total without an override reason", () => {
    const result = bookingCreateSchema.parse({
      ...valid,
      catalogSellAmountCents: 20000,
      confirmedSellAmountCents: 20000,
    })

    expect(result.confirmedSellAmountCents).toBe(20000)
  })

  it("requires a reason when the confirmed total differs from catalog pricing", () => {
    expect(() =>
      bookingCreateSchema.parse({
        ...valid,
        catalogSellAmountCents: 20000,
        confirmedSellAmountCents: 17500,
      }),
    ).toThrow()
  })

  it("accepts item lines and paid schedule rows", () => {
    const result = bookingCreateSchema.parse({
      ...valid,
      documentGeneration: {
        contractDocument: false,
        invoiceDocument: true,
      },
      itemLines: [
        { optionUnitId: "opun_dbl", quantity: 2, title: "Double room" },
        { optionUnitId: "opun_sgl", quantity: 1, title: "Single room" },
      ],
      paymentSchedules: [
        {
          scheduleType: "deposit",
          status: "paid",
          dueDate: "2026-05-16",
          currency: "EUR",
          amountCents: 10000,
          notes: JSON.stringify({
            alreadyPaid: true,
            paymentDate: "2026-05-16",
            paymentMethod: "bank_transfer",
            paymentReference: "BT-123",
          }),
        },
      ],
    })

    expect(result.itemLines).toHaveLength(2)
    expect(result.documentGeneration?.invoiceDocument).toBe(true)
    expect(result.paymentSchedules?.[0]?.status).toBe("paid")
  })

  it("defaults document generation controls to off", () => {
    const result = bookingCreateSchema.parse(valid)

    expect(result.documentGeneration).toEqual({
      contractDocument: false,
      invoiceDocument: false,
    })
  })
})
