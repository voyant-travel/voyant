import { describe, expect, it } from "vitest"
import { defineConfig } from "./index.js"

describe("framework project config", () => {
  it("expands an empty authored config to the standard distribution", () => {
    const project = defineConfig()

    expect(project.modules).toHaveLength(35)
    expect(project.extensions).toHaveLength(20)
    expect(project.plugins).toEqual([])
    expect(project.modules.map((unit) => unit.id).slice(0, 3)).toEqual([
      "@voyant-travel/action-ledger",
      "@voyant-travel/relationships",
      "@voyant-travel/quotes",
    ])
    expect(project.extensions.map((unit) => unit.schemaVersion)).toEqual(
      Array.from({ length: 20 }, () => "voyant.extension.v1"),
    )
    expect(project).not.toHaveProperty("presetLineage")
  })

  it("appends authored differences in their independent unit lanes", () => {
    const project = defineConfig({
      modules: [{ resolve: "./src/modules/team" }],
      extensions: [{ resolve: "@acme/reporting/extension" }],
      plugins: [{ resolve: "@voyant-travel/plugin-netopia" }],
      deployment: {
        target: "node",
        mode: "self-hosted",
        providers: { database: "postgres" },
      },
    })

    expect(project.modules).toHaveLength(36)
    expect(project.extensions).toHaveLength(21)
    expect(project.plugins).toHaveLength(1)
    expect(project.modules.at(-1)).toMatchObject({
      id: "local/src.modules.team",
      schemaVersion: "voyant.module.v1",
    })
    expect(project.extensions.at(-1)).toMatchObject({
      id: "@acme/reporting#extension",
      schemaVersion: "voyant.extension.v1",
    })
    expect(project.plugins[0]).toMatchObject({
      id: "@voyant-travel/plugin-netopia",
      schemaVersion: "voyant.plugin.v1",
    })
    expect(project.selections?.modules.at(-1)?.resolve).toBe("./src/modules/team")
    expect(project.selections?.extensions.at(-1)?.resolve).toBe("@acme/reporting#extension")
    expect(project.selections?.plugins.map((selection) => selection.resolve)).toEqual([
      "@voyant-travel/plugin-netopia",
    ])
    expect(project.deployment).toEqual({
      target: "node",
      mode: "self-hosted",
      providers: { database: "postgres" },
    })
  })
})
