import { describe, expect, it } from "vitest"

import { type CapabilityGraph, findCapabilityGaps } from "../../src/composition.js"

const graph: CapabilityGraph = {
  "@voyant-travel/relationships": { provides: ["people-directory"] },
  "@voyant-travel/bookings": { requires: ["people-directory"] },
  "@voyant-travel/legal": { requires: ["people-directory"] },
  "@voyant-travel/finance": {},
}

describe("findCapabilityGaps", () => {
  it("reports no gaps when every required capability is provided by a mounted module", () => {
    const gaps = findCapabilityGaps(
      ["@voyant-travel/relationships", "@voyant-travel/bookings", "@voyant-travel/legal"],
      graph,
    )
    expect(gaps).toEqual([])
  })

  it("reports a gap, with all consumers, when the provider is excluded", () => {
    // relationships dropped; bookings + legal still mounted and still require it.
    const gaps = findCapabilityGaps(["@voyant-travel/bookings", "@voyant-travel/legal"], graph)
    expect(gaps).toEqual([
      {
        capability: "people-directory",
        requiredBy: ["@voyant-travel/bookings", "@voyant-travel/legal"],
      },
    ])
  })

  it("reports no gap when the provider and all consumers are excluded together", () => {
    const gaps = findCapabilityGaps(["@voyant-travel/finance"], graph)
    expect(gaps).toEqual([])
  })

  it("ignores specifiers absent from the graph (no declaration = no constraint)", () => {
    const gaps = findCapabilityGaps(["@voyant-travel/unknown"], graph)
    expect(gaps).toEqual([])
  })

  it("sorts gaps by capability and requiredBy deterministically", () => {
    const wide: CapabilityGraph = {
      a: { requires: ["zeta"] },
      b: { requires: ["alpha"] },
      c: { requires: ["alpha"] },
    }
    const gaps = findCapabilityGaps(["c", "a", "b"], wide)
    expect(gaps).toEqual([
      { capability: "alpha", requiredBy: ["b", "c"] },
      { capability: "zeta", requiredBy: ["a"] },
    ])
  })
})
