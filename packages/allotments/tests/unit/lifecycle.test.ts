import { describe, expect, it } from "vitest"

import {
  allotmentPickupProgress,
  allotmentRemaining,
  eachDateInRange,
  isClosedAllotmentStatus,
} from "../../src/index.js"

describe("allotment lifecycle contract", () => {
  it("computes remaining", () => {
    expect(allotmentRemaining({ held: 10, pickedUp: 4, released: 2 })).toBe(4)
  })

  it("derives pickup progress from counters", () => {
    expect(allotmentPickupProgress({ held: 10, pickedUp: 0, released: 0 })).toBe("none")
    expect(allotmentPickupProgress({ held: 10, pickedUp: 4, released: 0 })).toBe("partial")
    expect(allotmentPickupProgress({ held: 10, pickedUp: 6, released: 4 })).toBe("full")
  })

  it("flags closed statuses", () => {
    expect(isClosedAllotmentStatus("confirmed")).toBe(false)
    expect(isClosedAllotmentStatus("released")).toBe(true)
    expect(isClosedAllotmentStatus("cancelled")).toBe(true)
    expect(isClosedAllotmentStatus("expired")).toBe(true)
  })

  it("enumerates slot dates (inclusive start, exclusive end)", () => {
    expect(eachDateInRange("2026-09-01", "2026-09-03")).toEqual(["2026-09-01", "2026-09-02"])
    expect(eachDateInRange("2026-09-01", "2026-09-01")).toEqual([])
    expect(eachDateInRange("bad", "2026-09-03")).toEqual([])
  })
})
