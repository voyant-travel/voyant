import { describe, expect, it } from "vitest"

import {
  createBlankTraveler,
  insertPersonTraveler,
  matchPricingCategoryForTraveler,
} from "../../src/components/travelers-section.js"

describe("traveler person insertion", () => {
  it("fills the initial blank lead row instead of appending a second traveler", () => {
    const blankLead = createBlankTraveler("lead")
    const personTraveler = {
      ...createBlankTraveler("adult"),
      personId: "person_1",
      firstName: "Ana",
      lastName: "Popescu",
    }

    const result = insertPersonTraveler([blankLead], personTraveler)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      clientTravelerKey: blankLead.clientTravelerKey,
      personId: "person_1",
      firstName: "Ana",
      lastName: "Popescu",
      role: "lead",
    })
  })
})

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
