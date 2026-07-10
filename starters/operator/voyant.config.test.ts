import { describe, expect, it } from "vitest"
import config from "./voyant.config.js"

describe("Operator project config", () => {
  it("authors only deployment differences and external plugins", () => {
    expect(config.modules).toHaveLength(35)
    expect(config.extensions).toHaveLength(20)
    expect(config.plugins).toHaveLength(1)
    expect(config).not.toHaveProperty("presetLineage")

    expect(config.selections?.modules).toHaveLength(35)
    expect(
      config.selections?.modules.every(({ provenance }) => provenance.kind === "package"),
    ).toBe(true)
    expect(config.selections?.extensions).toHaveLength(20)
    expect(config.selections?.plugins.map((selection) => selection.resolve)).toEqual([
      "@voyant-travel/plugin-netopia",
    ])
    expect(config.extensions.every((unit) => unit.schemaVersion === "voyant.extension.v1")).toBe(
      true,
    )
  })
})
