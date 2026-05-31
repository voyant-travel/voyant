import { describe, expect, it } from "vitest"

import {
  insertVoyageGroupSchema,
  insertVoyageGroupScopedSegmentSchema,
} from "../../src/validation-core.js"

describe("voyage group validation", () => {
  it("accepts composite voyage group kinds", () => {
    const parsed = insertVoyageGroupSchema.parse({
      slug: "grand-voyage-2027",
      name: "Grand Voyage 2027",
      groupKind: "grand_voyage",
      nights: 45,
    })

    expect(parsed).toMatchObject({
      groupKind: "grand_voyage",
      status: "draft",
      externalRefs: {},
    })
  })

  it("accepts scoped land extension segments without duplicating the group id in the body", () => {
    const parsed = insertVoyageGroupScopedSegmentSchema.parse({
      sortOrder: 0,
      segmentKind: "land",
      segmentRole: "pre_extension",
      title: "Patagonia pre-tour",
      startDay: 1,
      endDay: 4,
      nights: 3,
    })

    expect(parsed).toMatchObject({
      segmentKind: "land",
      segmentRole: "pre_extension",
      metadata: {},
    })
  })

  it("rejects inverted segment day ranges", () => {
    expect(() =>
      insertVoyageGroupScopedSegmentSchema.parse({
        sortOrder: 2,
        segmentKind: "cruise",
        title: "Main sailing",
        startDay: 10,
        endDay: 3,
      }),
    ).toThrow(/endDay/)
  })
})
