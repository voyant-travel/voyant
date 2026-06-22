import { describe, expect, it } from "vitest"

import { type CapabilityGraph, findCapabilityGaps, findCapabilityProviders } from "./composition.js"

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

  it("treats an injected substitute as satisfying the capability", () => {
    const gaps = findCapabilityGaps(["@voyant-travel/bookings"], graph, ["people-directory"])
    expect(gaps).toEqual([])
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

describe("findCapabilityProviders", () => {
  it("returns the module(s) that provide a capability token", () => {
    const providers = findCapabilityProviders(
      ["@voyant-travel/relationships", "@voyant-travel/bookings"],
      graph,
      "people-directory",
    )
    expect(providers).toEqual(["@voyant-travel/relationships"])
  })

  it("returns empty when no mounted module provides the token", () => {
    expect(findCapabilityProviders(["@voyant-travel/bookings"], graph, "people-directory")).toEqual(
      [],
    )
    expect(findCapabilityProviders(["@voyant-travel/relationships"], graph, "nope")).toEqual([])
  })

  it("sorts multiple providers deterministically", () => {
    const dual: CapabilityGraph = {
      b: { provides: ["x"] },
      a: { provides: ["x"] },
    }
    expect(findCapabilityProviders(["b", "a"], dual, "x")).toEqual(["a", "b"])
  })
})
