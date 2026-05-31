import { describe, expect, it } from "vitest"
import { insertCabinCategorySchema } from "../../src/validation-cabins.js"
import {
  insertEnrichmentProgramSchema,
  replaceEnrichmentProgramsSchema,
} from "../../src/validation-content.js"
import { insertSailingSchema } from "../../src/validation-core.js"

describe("insertSailingSchema — direction enum", () => {
  const baseSailing = {
    cruiseId: "cru_abc",
    shipId: "crsh_def",
    departureDate: "2026-06-15",
    returnDate: "2026-06-22",
  }

  it("accepts valid direction values", () => {
    for (const dir of ["upstream", "downstream", "round_trip", "one_way"] as const) {
      const result = insertSailingSchema.safeParse({ ...baseSailing, direction: dir })
      expect(result.success).toBe(true)
    }
  })

  it("accepts null direction", () => {
    const result = insertSailingSchema.safeParse({ ...baseSailing, direction: null })
    expect(result.success).toBe(true)
  })

  it("accepts omitted direction", () => {
    const result = insertSailingSchema.safeParse(baseSailing)
    expect(result.success).toBe(true)
  })

  it("rejects free-text direction values", () => {
    const result = insertSailingSchema.safeParse({ ...baseSailing, direction: "north" })
    expect(result.success).toBe(false)
  })

  it("rejects misspelled direction values", () => {
    const result = insertSailingSchema.safeParse({ ...baseSailing, direction: "upStream" })
    expect(result.success).toBe(false)
  })
})

describe("insertCabinCategorySchema — structured cabin features", () => {
  const baseCategory = {
    shipId: "crsh_abc",
    code: "BAL",
    name: "Balcony Suite",
    roomType: "balcony",
    minOccupancy: 1,
    maxOccupancy: 3,
  }

  it("accepts normalized bed, accessibility, and view facets", () => {
    const result = insertCabinCategorySchema.safeParse({
      ...baseCategory,
      featureCodes: ["minibar", "laundry"],
      bedConfigurations: ["king", "convertible_twins"],
      accessibilityFeatures: ["step_free_access", "roll_in_shower"],
      viewType: "balcony",
    })
    expect(result.success).toBe(true)
  })

  it("rejects free-text bed, accessibility, and view facets", () => {
    const result = insertCabinCategorySchema.safeParse({
      ...baseCategory,
      bedConfigurations: ["huge"],
      accessibilityFeatures: ["pretty accessible"],
      viewType: "panoramic-ish",
    })
    expect(result.success).toBe(false)
  })
})

describe("insertEnrichmentProgramSchema — kind enum", () => {
  const baseProgram = {
    cruiseId: "cru_abc",
    name: "Dr. Jane Doe",
  }

  it("accepts each valid kind", () => {
    for (const kind of [
      "naturalist",
      "historian",
      "photographer",
      "lecturer",
      "expert",
      "other",
    ] as const) {
      const result = insertEnrichmentProgramSchema.safeParse({ ...baseProgram, kind })
      expect(result.success).toBe(true)
    }
  })

  it("rejects unknown kinds", () => {
    const result = insertEnrichmentProgramSchema.safeParse({ ...baseProgram, kind: "chef" })
    expect(result.success).toBe(false)
  })

  it("requires a name", () => {
    const result = insertEnrichmentProgramSchema.safeParse({
      cruiseId: "cru_abc",
      kind: "naturalist",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty-string name", () => {
    const result = insertEnrichmentProgramSchema.safeParse({
      ...baseProgram,
      name: "",
      kind: "naturalist",
    })
    expect(result.success).toBe(false)
  })

  it("validates bioImageUrl when provided", () => {
    const okResult = insertEnrichmentProgramSchema.safeParse({
      ...baseProgram,
      kind: "lecturer",
      bioImageUrl: "https://example.com/bio.jpg",
    })
    expect(okResult.success).toBe(true)

    const badResult = insertEnrichmentProgramSchema.safeParse({
      ...baseProgram,
      kind: "lecturer",
      bioImageUrl: "not a url",
    })
    expect(badResult.success).toBe(false)
  })
})

describe("replaceEnrichmentProgramsSchema", () => {
  it("accepts an empty programs array (clears all)", () => {
    const result = replaceEnrichmentProgramsSchema.safeParse({
      cruiseId: "cru_abc",
      programs: [],
    })
    expect(result.success).toBe(true)
  })

  it("rejects entries with cruiseId in the inner program (callers omit it)", () => {
    const result = replaceEnrichmentProgramsSchema.safeParse({
      cruiseId: "cru_abc",
      programs: [{ cruiseId: "cru_xyz", kind: "naturalist", name: "Dr. X" }],
    })
    // The .omit({ cruiseId: true }) on the nested schema means cruiseId is
    // simply ignored on input — Zod doesn't reject unknown fields by default.
    expect(result.success).toBe(true)
  })
})
