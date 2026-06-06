import { describe, expect, it } from "vitest"
import type { ProductGraphSpec } from "../../src/spec.js"
import { validateProductGraph } from "../../src/validate.js"

function spec(partial: {
  bookingMode: ProductGraphSpec["product"]["bookingMode"]
  unitType?: ProductGraphSpec["options"][number]["units"][number]["unitType"]
  days?: number
}): ProductGraphSpec {
  const days = Array.from({ length: partial.days ?? 0 }, (_, i) => ({
    dayNumber: i + 1,
    title: `Day ${i + 1}`,
    description: null,
    location: null,
    services: [],
  }))
  return {
    product: {
      name: "X",
      status: "draft",
      bookingMode: partial.bookingMode,
      capacityMode: "limited",
      visibility: "private",
      sellCurrency: "RON",
      termsShowOnContract: false,
      tags: [],
    } as ProductGraphSpec["product"],
    options: [
      {
        ref: "o",
        name: "Standard",
        status: "active",
        isDefault: true,
        sortOrder: 0,
        units: [
          {
            ref: "u",
            name: "Adult",
            unitType: partial.unitType ?? "person",
            isRequired: true,
            isHidden: false,
            sortOrder: 0,
          },
        ],
        priceRules: [],
      },
    ] as ProductGraphSpec["options"],
    paxPricingTiers: [],
    itineraries: days.length
      ? ([{ name: "Main", isDefault: true, sortOrder: 0, days }] as ProductGraphSpec["itineraries"])
      : [],
  }
}

describe("validateProductGraph", () => {
  it("accepts a single-day excursion", () => {
    expect(validateProductGraph(spec({ bookingMode: "date", days: 1 }))).toEqual([])
  })

  it("rejects an excursion with multiple days, with a recoverable message", () => {
    const issues = validateProductGraph(spec({ bookingMode: "date", days: 3 }))
    const issue = issues.find((i) => i.code === "excursion_multi_day")
    expect(issue).toBeDefined()
    expect(issue?.message).toContain("3 itinerary days")
    expect(issue?.fix).toContain("itinerary")
  })

  it("rejects an excursion priced per room", () => {
    const issues = validateProductGraph(spec({ bookingMode: "date", unitType: "room", days: 1 }))
    expect(issues.some((i) => i.code === "excursion_room_unit")).toBe(true)
  })

  it("rejects a multi-day tour with fewer than 2 days", () => {
    const issues = validateProductGraph(spec({ bookingMode: "itinerary", days: 1 }))
    expect(issues.some((i) => i.code === "tour_needs_days")).toBe(true)
  })

  it("accepts a multi-day tour with 2+ days", () => {
    expect(validateProductGraph(spec({ bookingMode: "itinerary", days: 2 }))).toEqual([])
  })

  it("rejects a transfer that carries itinerary days", () => {
    const issues = validateProductGraph(
      spec({ bookingMode: "transfer", unitType: "vehicle", days: 2 }),
    )
    expect(issues.some((i) => i.code === "transfer_no_days")).toBe(true)
  })

  it("accepts a transfer with vehicle units and no days", () => {
    expect(validateProductGraph(spec({ bookingMode: "transfer", unitType: "vehicle" }))).toEqual([])
  })

  it("rejects a product with no options", () => {
    const s = spec({ bookingMode: "date", days: 1 })
    s.options = []
    expect(validateProductGraph(s).some((i) => i.code === "no_options")).toBe(true)
  })
})
