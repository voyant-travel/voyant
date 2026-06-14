import { describe, expect, it } from "vitest"

import {
  aggregateComponentPricing,
  pricingSnapshotFromBreakdown,
  taxLinesFromBreakdown,
} from "../src/service.js"

describe("trips pricing helpers", () => {
  it("preserves component-level tax lines from booking-engine pricing", () => {
    const pricing = {
      currency: "EUR",
      lines: [{ kind: "base" as const, label: "Stay", unitAmount: 10000, totalAmount: 10000 }],
      taxes: [
        {
          code: "vat-ro-9",
          label: "VAT 9%",
          rate: 0.09,
          amount: 900,
          base: 10000,
          includedInPrice: false,
          scope: "excluded" as const,
        },
      ],
      subtotal: 10000,
      taxTotal: 900,
      total: 10900,
    }

    expect(pricingSnapshotFromBreakdown(pricing, "2026-05-18T12:00:00.000Z")).toEqual({
      currency: "EUR",
      subtotalAmountCents: 10000,
      taxAmountCents: 900,
      totalAmountCents: 10900,
      priceExpiresAt: "2026-05-18T12:00:00.000Z",
      warnings: undefined,
    })
    expect(taxLinesFromBreakdown(pricing)).toEqual([
      {
        code: "vat-ro-9",
        label: "VAT 9%",
        amountCents: 900,
        baseAmountCents: 10000,
        rate: 0.09,
        includedInPrice: false,
        source: "excluded",
      },
    ])
  })

  it("aggregates component totals without blending tax treatment", () => {
    const aggregate = aggregateComponentPricing(
      [
        {
          pricingSnapshot: {
            currency: "EUR",
            subtotalAmountCents: 10000,
            taxAmountCents: 900,
            totalAmountCents: 10900,
          },
          warningCodes: [],
        },
        {
          pricingSnapshot: {
            currency: "EUR",
            subtotalAmountCents: 20000,
            taxAmountCents: 3800,
            totalAmountCents: 23800,
          },
          warningCodes: ["manual_placeholder_price"],
        },
      ],
      "EUR",
    )

    expect(aggregate).toEqual({
      currency: "EUR",
      subtotalAmountCents: 30000,
      taxAmountCents: 4700,
      totalAmountCents: 34700,
      componentCount: 2,
      pricedComponentCount: 2,
      warnings: ["manual_placeholder_price"],
    })
  })

  it("warns and excludes mismatched currencies from the aggregate amount", () => {
    const aggregate = aggregateComponentPricing(
      [
        {
          pricingSnapshot: {
            currency: "EUR",
            subtotalAmountCents: 10000,
            taxAmountCents: 900,
            totalAmountCents: 10900,
          },
          warningCodes: [],
        },
        {
          pricingSnapshot: {
            currency: "USD",
            subtotalAmountCents: 10000,
            taxAmountCents: 0,
            totalAmountCents: 10000,
          },
          warningCodes: [],
        },
      ],
      "EUR",
    )

    expect(aggregate.totalAmountCents).toBe(10900)
    expect(aggregate.warnings).toEqual(["currency_mismatch:USD"])
  })
})
