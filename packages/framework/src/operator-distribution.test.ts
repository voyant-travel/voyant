import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  mergeOperatorDistributionDefaults,
  STANDARD_OPERATOR_DISTRIBUTION,
} from "./operator-distribution.js"

describe("standard Operator distribution", () => {
  it("declares the complete package-owned Node closure in stable order", () => {
    expect(STANDARD_OPERATOR_DISTRIBUTION).toMatchObject({
      id: "operator-standard",
      target: "node",
    })
    expect(STANDARD_OPERATOR_DISTRIBUTION.modules).toHaveLength(35)
    expect(STANDARD_OPERATOR_DISTRIBUTION.modules.slice(0, 3)).toEqual([
      "@voyant-travel/action-ledger",
      "@voyant-travel/relationships",
      "@voyant-travel/quotes",
    ])
    expect(STANDARD_OPERATOR_DISTRIBUTION.modules.slice(-3)).toEqual([
      "@voyant-travel/availability",
      "@voyant-travel/catalog-authoring",
      "@voyant-travel/workflow-runs",
    ])
    expect(STANDARD_OPERATOR_DISTRIBUTION.extensions).toHaveLength(20)
    expect(STANDARD_OPERATOR_DISTRIBUTION.extensions).toContain(
      "@voyant-travel/distribution/extension",
    )
    expect(STANDARD_OPERATOR_DISTRIBUTION.extensions.at(-1)).toBe(
      "@voyant-travel/mice/booking-extension",
    )
    expect(new Set(STANDARD_OPERATOR_DISTRIBUTION.modules).size).toBe(35)
    expect(new Set(STANDARD_OPERATOR_DISTRIBUTION.extensions).size).toBe(20)
    expect(STANDARD_OPERATOR_DISTRIBUTION).not.toHaveProperty("presetLineage")
  })

  it("defaults authored differences without treating extensions as plugins", () => {
    expect(mergeOperatorDistributionDefaults()).toEqual({
      modules: STANDARD_OPERATOR_DISTRIBUTION.modules,
      extensions: STANDARD_OPERATOR_DISTRIBUTION.extensions,
      plugins: [],
    })
  })

  it("appends each consumer-owned unit kind independently and deterministically", () => {
    const differences = {
      modules: [{ resolve: "./src/modules/team" }],
      extensions: [{ resolve: "./src/extensions/reporting" }],
      plugins: [{ resolve: "@voyant-travel/plugin-netopia" }],
    } as const

    const first = mergeOperatorDistributionDefaults(differences)
    const second = mergeOperatorDistributionDefaults(differences)

    expect(first).toEqual(second)
    expect(first.modules.at(-1)).toEqual(differences.modules[0])
    expect(first.extensions.at(-1)).toEqual(differences.extensions[0])
    expect(first.plugins).toEqual(differences.plugins)
    expect(first.extensions).not.toContain(differences.plugins[0])
  })

  it("accepts future distribution variants without adding runtime lineage", () => {
    const variant = {
      id: "operator-compact",
      target: "node",
      modules: ["@voyant-travel/identity"],
      extensions: [],
    } as const

    expect(mergeOperatorDistributionDefaults({}, variant)).toEqual({
      modules: variant.modules,
      extensions: [],
      plugins: [],
    })
  })

  it("has no runtime imports or starter coupling", () => {
    const source = readFileSync(new URL("operator-distribution.ts", import.meta.url), "utf8")
    expect(source).not.toMatch(/^import (?!type\b)/m)
    expect(source).not.toContain("starters/")
    expect(source).not.toContain("managed-operator")
  })
})
