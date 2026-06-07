import { describe, expect, it } from "vitest"

import {
  CRUISES_CONTENT_SCHEMA_VERSION,
  type CruiseContent,
  cruiseContentSchema,
  validateCruiseContent,
} from "./index.js"

describe("@voyantjs/cruises-contracts content shape", () => {
  it("validates the cruises/v1 rich content payload", () => {
    const content = cruiseContentSchema.parse({
      cruise: {
        id: "cru_123",
        name: "Danube Highlights",
      },
      sailings: [
        {
          id: "crsl_123",
          start_date: "2026-07-01",
          end_date: "2026-07-08",
          board_basis: "full_board",
          lowest_price_cents: 120000,
          currency: "EUR",
        },
      ],
    }) satisfies CruiseContent

    expect(CRUISES_CONTENT_SCHEMA_VERSION).toBe("cruises/v1")
    expect(validateCruiseContent(content)).toMatchObject({ valid: true })
    expect(content.sailings[0]?.itinerary_stops).toEqual([])
    expect(content.sailings[0]?.board_basis).toBe("full_board")
  })

  it("carries structured cabin feature facets", () => {
    const content = cruiseContentSchema.parse({
      cruise: { id: "cru_123", name: "Danube Highlights" },
      cabin_categories: [
        { id: "cab_inside", name: "Inside", type: "inside", view_type: "interior" },
        {
          id: "cab_balcony",
          name: "Balcony",
          type: "balcony",
          feature_codes: ["minibar"],
          bed_configurations: ["king", "convertible_twins"],
          accessibility_features: ["step_free_access"],
          view_type: "balcony",
        },
      ],
    }) satisfies CruiseContent

    expect(content.cabin_categories[1]?.feature_codes).toEqual(["minibar"])
    expect(content.cabin_categories[1]?.bed_configurations).toEqual(["king", "convertible_twins"])
    expect(content.cabin_categories[1]?.accessibility_features).toEqual(["step_free_access"])
    expect(content.cabin_categories[1]?.view_type).toBe("balcony")
  })

  it("defaults cabin feature facets when omitted", () => {
    const content = cruiseContentSchema.parse({
      cruise: { id: "cru_123", name: "Danube Highlights" },
      cabin_categories: [{ id: "cab_inside", name: "Inside" }],
    }) satisfies CruiseContent

    expect(content.cabin_categories[0]?.feature_codes).toEqual([])
    expect(content.cabin_categories[0]?.bed_configurations).toEqual([])
    expect(content.cabin_categories[0]?.accessibility_features).toEqual([])
    expect(content.cabin_categories[0]?.view_type).toBeNull()
  })

  it("rejects unknown cabin facet enum values", () => {
    expect(
      validateCruiseContent({
        cruise: { id: "cru_123", name: "Danube Highlights" },
        cabin_categories: [{ id: "cab_x", name: "X", view_type: "spaceship" }],
      }),
    ).toMatchObject({ valid: false })
  })

  it("rejects partial browse price hints", () => {
    const result = validateCruiseContent({
      cruise: {
        id: "cru_123",
        name: "Danube Highlights",
      },
      sailings: [
        {
          id: "crsl_123",
          start_date: "2026-07-01",
          end_date: "2026-07-08",
          lowest_price_cents: 120000,
        },
      ],
    })

    expect(result).toMatchObject({ valid: false })
  })

  it("rejects unknown sailing board basis values", () => {
    expect(
      validateCruiseContent({
        cruise: { id: "cru_123", name: "Danube Highlights" },
        sailings: [
          {
            id: "crsl_123",
            start_date: "2026-07-01",
            end_date: "2026-07-08",
            board_basis: "brunch_only",
          },
        ],
      }),
    ).toMatchObject({ valid: false })
  })
})
