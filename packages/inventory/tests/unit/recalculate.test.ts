import { describe, expect, it } from "vitest"

/**
 * Unit tests for the margin computation logic.
 * The formula is: marginPercent = round(((sell - cost) / sell) * 100)
 */

function computeMarginPercent(sellAmountCents: number, costAmountCents: number): number {
  if (sellAmountCents <= 0) return 0
  return Math.round(((sellAmountCents - costAmountCents) / sellAmountCents) * 100)
}

function sumServiceCosts(services: { costAmountCents: number; quantity: number }[]): number {
  return services.reduce((sum, s) => sum + s.costAmountCents * s.quantity, 0)
}

describe("Product cost recalculation", () => {
  describe("sumServiceCosts", () => {
    it("returns 0 for empty services", () => {
      expect(sumServiceCosts([])).toBe(0)
    })

    it("sums single service cost", () => {
      expect(sumServiceCosts([{ costAmountCents: 5000, quantity: 1 }])).toBe(5000)
    })

    it("multiplies cost by quantity", () => {
      expect(sumServiceCosts([{ costAmountCents: 5000, quantity: 3 }])).toBe(15000)
    })

    it("sums multiple services", () => {
      expect(
        sumServiceCosts([
          { costAmountCents: 5000, quantity: 1 },
          { costAmountCents: 3000, quantity: 2 },
          { costAmountCents: 1000, quantity: 1 },
        ]),
      ).toBe(12000)
    })
  })

  describe("computeMarginPercent", () => {
    it("returns 0 when sell amount is 0", () => {
      expect(computeMarginPercent(0, 5000)).toBe(0)
    })

    it("returns 0 when sell amount is negative", () => {
      expect(computeMarginPercent(-1000, 5000)).toBe(0)
    })

    it("computes 100% margin when cost is 0", () => {
      expect(computeMarginPercent(10000, 0)).toBe(100)
    })

    it("computes correct margin for typical case", () => {
      // sell: 100.00, cost: 70.00 → margin = (100 - 70) / 100 * 100 = 30%
      expect(computeMarginPercent(10000, 7000)).toBe(30)
    })

    it("computes 50% margin", () => {
      // sell: 200.00, cost: 100.00 → margin = 50%
      expect(computeMarginPercent(20000, 10000)).toBe(50)
    })

    it("handles negative margin (cost > sell)", () => {
      // sell: 100.00, cost: 120.00 → margin = (100 - 120) / 100 * 100 = -20%
      expect(computeMarginPercent(10000, 12000)).toBe(-20)
    })

    it("rounds to nearest integer", () => {
      // sell: 300.00, cost: 200.00 → margin = 33.33... → rounds to 33
      expect(computeMarginPercent(30000, 20000)).toBe(33)
    })

    it("computes margin for small amounts", () => {
      // sell: 1.00, cost: 0.50 → margin = 50%
      expect(computeMarginPercent(100, 50)).toBe(50)
    })
  })
})
