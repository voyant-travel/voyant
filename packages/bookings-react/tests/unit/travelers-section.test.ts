import { describe, expect, it } from "vitest"

import { matchPricingCategoryForTraveler } from "../../src/components/travelers-section.js"

describe("traveler pricing category matching", () => {
  it("does not let unbounded adult categories capture child DOB matches", () => {
    const result = matchPricingCategoryForTraveler(
      [
        {
          categoryId: "pcat_adult",
          name: "Adult",
          code: "ADULT",
          categoryType: "adult",
          minAge: null,
          maxAge: null,
          unitIds: ["optu_double"],
        },
        {
          categoryId: "pcat_child",
          name: "Child under 12",
          code: "CHILD",
          categoryType: "child",
          minAge: 0,
          maxAge: 12,
          unitIds: ["optu_double"],
        },
      ],
      "2020-01-01",
      "child",
      "optu_double",
    )

    expect(result).toBe("pcat_child")
  })
})
