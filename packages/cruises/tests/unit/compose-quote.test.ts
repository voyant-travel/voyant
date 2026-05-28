import { describe, expect, it } from "vitest"

import { type ComposeQuoteInput, composeQuote } from "../../src/service-pricing.js"

const makePrice = (
  overrides: Partial<ComposeQuoteInput["price"]> = {},
): ComposeQuoteInput["price"] => ({
  pricePerPerson: "1000.00",
  secondGuestPricePerPerson: null,
  singleSupplementPercent: null,
  currency: "USD",
  fareCode: "STANDARD",
  fareCodeName: "Standard fare",
  ...overrides,
})

describe("composeQuote — basic per-person multiplication", () => {
  it("doubles the per-person price for a 2-guest occupancy=2 cabin", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "2500.00" }),
      components: [],
      occupancy: 2,
      guestCount: 2,
    })
    expect(quote.basePerPerson).toBe("2500.00")
    expect(quote.totalForCabin).toBe("5000.00")
    expect(quote.totalPerPerson).toBe("2500.00")
    expect(quote.currency).toBe("USD")
  })

  it("handles a 4-guest quad cabin", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1750.50" }),
      components: [],
      occupancy: 4,
      guestCount: 4,
    })
    expect(quote.totalForCabin).toBe("7002.00")
    expect(quote.totalPerPerson).toBe("1750.50")
  })
})

describe("composeQuote — single supplement", () => {
  it("applies a percentage supplement when occupancy=1", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1000.00", singleSupplementPercent: "75.00" }),
      components: [],
      occupancy: 1,
      guestCount: 1,
    })
    // 1000 + 75% = 1750 for the single occupant
    expect(quote.totalForCabin).toBe("1750.00")
    expect(quote.totalPerPerson).toBe("1750.00")
  })

  it("ignores singleSupplementPercent if occupancy is not 1", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1000.00", singleSupplementPercent: "75.00" }),
      components: [],
      occupancy: 2,
      guestCount: 2,
    })
    expect(quote.totalForCabin).toBe("2000.00")
  })

  it("handles fractional percentage supplements", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1000.00", singleSupplementPercent: "12.50" }),
      components: [],
      occupancy: 1,
      guestCount: 1,
    })
    expect(quote.totalForCabin).toBe("1125.00")
  })
})

describe("composeQuote — second-guest pricing", () => {
  it("uses secondGuestPricePerPerson when occupancy=2 and guestCount=2", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1500.00", secondGuestPricePerPerson: "750.00" }),
      components: [],
      occupancy: 2,
      guestCount: 2,
    })
    // First guest: $1500 + Second guest: $750 = $2250 total
    expect(quote.totalForCabin).toBe("2250.00")
    expect(quote.totalPerPerson).toBe("1125.00")
  })

  it("ignores secondGuestPricePerPerson when only one guest is booked", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1500.00", secondGuestPricePerPerson: "750.00" }),
      components: [],
      occupancy: 2,
      guestCount: 1,
    })
    // Falls through to standard per-person × guestCount = 1500 × 1
    expect(quote.totalForCabin).toBe("1500.00")
  })
})

describe("composeQuote — price components", () => {
  it("adds 'addition' components multiplied by guestCount when perPerson=true", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1000.00" }),
      components: [
        {
          kind: "gratuity",
          label: "Pre-paid gratuities",
          amount: "15.00",
          currency: "USD",
          direction: "addition",
          perPerson: true,
        },
      ],
      occupancy: 2,
      guestCount: 2,
    })
    // 2000 base + 30 (15 × 2 guests) = 2030
    expect(quote.totalForCabin).toBe("2030.00")
  })

  it("adds 'addition' components once when perPerson=false", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1000.00" }),
      components: [
        {
          kind: "port_charge",
          label: "Port charges",
          amount: "200.00",
          currency: "USD",
          direction: "addition",
          perPerson: false,
        },
      ],
      occupancy: 2,
      guestCount: 2,
    })
    expect(quote.totalForCabin).toBe("2200.00")
  })

  it("subtracts 'credit' components", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1000.00" }),
      components: [
        {
          kind: "onboard_credit",
          label: "Black Friday OBC",
          amount: "250.00",
          currency: "USD",
          direction: "credit",
          perPerson: false,
        },
      ],
      occupancy: 2,
      guestCount: 2,
    })
    expect(quote.totalForCabin).toBe("1750.00")
  })

  it("ignores 'inclusion' components for total math but renders them", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1000.00" }),
      components: [
        {
          kind: "transfer",
          label: "Round-trip airport transfer included",
          amount: "0.00",
          currency: "USD",
          direction: "inclusion",
          perPerson: false,
        },
      ],
      occupancy: 2,
      guestCount: 2,
    })
    expect(quote.totalForCabin).toBe("2000.00")
    expect(quote.components).toHaveLength(1)
    expect(quote.components[0]?.direction).toBe("inclusion")
  })

  it("composes additions + credits + inclusions in one quote", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1000.00" }),
      components: [
        {
          kind: "gratuity",
          label: null,
          amount: "20.00",
          currency: "USD",
          direction: "addition",
          perPerson: true,
        },
        {
          kind: "port_charge",
          label: null,
          amount: "150.00",
          currency: "USD",
          direction: "addition",
          perPerson: false,
        },
        {
          kind: "onboard_credit",
          label: null,
          amount: "100.00",
          currency: "USD",
          direction: "credit",
          perPerson: true,
        },
        {
          kind: "transfer",
          label: null,
          amount: "0.00",
          currency: "USD",
          direction: "inclusion",
          perPerson: false,
        },
      ],
      occupancy: 2,
      guestCount: 2,
    })
    // 2000 base + (20 × 2) + 150 - (100 × 2) = 2000 + 40 + 150 - 200 = 1990
    expect(quote.totalForCabin).toBe("1990.00")
    expect(quote.totalPerPerson).toBe("995.00")
    expect(quote.components).toHaveLength(4)
  })

  it("preserves residual components and booking terms in external quote snapshots", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1000.00" }),
      components: [
        {
          kind: "other",
          label: "Supplier adjustment",
          amount: "25.00",
          currency: "USD",
          direction: "addition",
          perPerson: false,
        },
        {
          kind: "single_supplement",
          label: "Single supplement",
          amount: "100.00",
          currency: "USD",
          direction: "addition",
          perPerson: false,
        },
      ],
      occupancy: 1,
      guestCount: 1,
      bookingTerms: {
        cancellationPolicy: {
          summary: "Refundable until final payment.",
          rules: [{ until: "2027-01-01", penaltyPercent: "0.00" }],
        },
        paymentTerms: { depositPercent: "25.00", dueDate: "2026-12-01" },
      },
    })
    expect(quote.totalForCabin).toBe("1125.00")
    expect(quote.components.map((component) => component.kind)).toEqual([
      "other",
      "single_supplement",
    ])
    expect(quote.bookingTerms?.cancellationPolicy?.summary).toBe("Refundable until final payment.")
  })
})

describe("composeQuote — currency", () => {
  it("preserves a non-USD currency", () => {
    const quote = composeQuote({
      price: makePrice({ pricePerPerson: "1500.00", currency: "EUR" }),
      components: [
        {
          kind: "gratuity",
          label: null,
          amount: "10.00",
          currency: "EUR",
          direction: "addition",
          perPerson: true,
        },
      ],
      occupancy: 2,
      guestCount: 2,
    })
    expect(quote.currency).toBe("EUR")
    expect(quote.totalForCabin).toBe("3020.00")
  })

  it("rejects components with mismatched currency", () => {
    expect(() =>
      composeQuote({
        price: makePrice({ currency: "USD" }),
        components: [
          {
            kind: "gratuity",
            label: null,
            amount: "10.00",
            currency: "EUR",
            direction: "addition",
            perPerson: true,
          },
        ],
        occupancy: 2,
        guestCount: 2,
      }),
    ).toThrow(/currency/)
  })
})

describe("composeQuote — input validation", () => {
  it("rejects guestCount > occupancy", () => {
    expect(() =>
      composeQuote({
        price: makePrice(),
        components: [],
        occupancy: 2,
        guestCount: 3,
      }),
    ).toThrow(/guestCount/)
  })

  it("rejects guestCount < 1", () => {
    expect(() =>
      composeQuote({
        price: makePrice(),
        components: [],
        occupancy: 2,
        guestCount: 0,
      }),
    ).toThrow(/guestCount/)
  })

  it("rejects occupancy < 1", () => {
    expect(() =>
      composeQuote({
        price: makePrice(),
        components: [],
        occupancy: 0,
        guestCount: 1,
      }),
    ).toThrow(/occupancy/)
  })

  it("rejects malformed money strings", () => {
    expect(() =>
      composeQuote({
        price: makePrice({ pricePerPerson: "not-a-number" }),
        components: [],
        occupancy: 2,
        guestCount: 2,
      }),
    ).toThrow(/Invalid money/)
  })
})

describe("composeQuote — exposes fare metadata", () => {
  it("returns fareCode and fareCodeName from the price row", () => {
    const quote = composeQuote({
      price: makePrice({ fareCode: "EARLY_BIRD", fareCodeName: "Early Booking Discount" }),
      components: [],
      occupancy: 2,
      guestCount: 2,
    })
    expect(quote.fareCode).toBe("EARLY_BIRD")
    expect(quote.fareCodeName).toBe("Early Booking Discount")
  })

  it("handles null fareCode", () => {
    const quote = composeQuote({
      price: makePrice({ fareCode: null, fareCodeName: null }),
      components: [],
      occupancy: 2,
      guestCount: 2,
    })
    expect(quote.fareCode).toBeNull()
    expect(quote.fareCodeName).toBeNull()
  })
})
