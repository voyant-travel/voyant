import { describe, expect, it } from "vitest"
import config from "./voyant.config.js"

describe("Operator project config", () => {
  it("authors only deployment differences, local modules, and external plugins", () => {
    expect(config.modules).toHaveLength(38)
    expect(config.extensions).toHaveLength(20)
    expect(config.plugins).toHaveLength(1)
    expect(config).not.toHaveProperty("presetLineage")

    expect(config.selections?.modules.slice(-3).map((selection) => selection.resolve)).toEqual([
      "./src/modules/mcp",
      "./src/modules/invitations",
      "./src/modules/team",
    ])
    expect(config.selections?.extensions).toHaveLength(20)
    expect(config.selections?.plugins.map((selection) => selection.resolve)).toEqual([
      "@voyant-travel/plugin-netopia",
    ])
    expect(config.extensions.every((unit) => unit.schemaVersion === "voyant.extension.v1")).toBe(
      true,
    )
  })
})
