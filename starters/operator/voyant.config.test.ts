import path from "node:path"

import { resolveProject } from "@voyant-travel/framework/project"
import { netopiaVoyantPlugin } from "@voyant-travel/plugin-netopia/voyant"
import { describe, expect, it } from "vitest"
import config from "./voyant.config.js"

const operatorRoot = process.cwd()

describe("Operator project config", () => {
  it("authors only deployment differences and external plugins", () => {
    expect(config.modules).toHaveLength(35)
    expect(config.extensions).toHaveLength(22)
    expect(config.plugins).toHaveLength(2)
    expect(config).not.toHaveProperty("presetLineage")
    expect(config.access?.presets?.map((preset) => preset.id)).toEqual([
      "agent-staff",
      "commerce-read",
      "editor",
    ])

    expect(config.selections?.modules).toHaveLength(35)
    expect(
      config.selections?.modules.every(({ provenance }) => provenance.kind === "package"),
    ).toBe(true)
    expect(config.selections?.extensions).toHaveLength(22)
    expect(config.selections?.plugins.map((selection) => selection.resolve)).toEqual([
      "@voyant-travel/plugin-netopia",
      "@voyant-travel/plugin-smartbill",
    ])
    expect(config.extensions.every((unit) => unit.schemaVersion === "voyant.extension.v1")).toBe(
      true,
    )
  })

  it("resolves Netopia from its package-owned Voyant manifest", async () => {
    const { graph } = await resolveProject({
      project: config,
      projectRoot: operatorRoot,
      configPath: path.join(operatorRoot, "voyant.config.ts"),
    })
    const plugin = graph.plugins.find((unit) => unit.id === netopiaVoyantPlugin.id)
    const packageRecord = graph.packageRecords.find(
      (record) => record.packageName === "@voyant-travel/plugin-netopia",
    )

    expect(config.plugins[0]).not.toHaveProperty("api")
    expect(packageRecord).toMatchObject({
      version: "0.105.20",
      metadata: {
        kind: "plugin",
        manifest: "./voyant",
      },
    })
    expect(plugin).toMatchObject({
      id: netopiaVoyantPlugin.id,
      packageName: netopiaVoyantPlugin.packageName,
      provides: netopiaVoyantPlugin.provides,
      requires: netopiaVoyantPlugin.requires,
      api: expect.arrayContaining([...(netopiaVoyantPlugin.api ?? [])]),
      config: expect.arrayContaining([...(netopiaVoyantPlugin.config ?? [])]),
      secrets: expect.arrayContaining([...(netopiaVoyantPlugin.secrets ?? [])]),
      webhooks: expect.arrayContaining([...(netopiaVoyantPlugin.webhooks ?? [])]),
    })
    expect(graph.diagnostics).toEqual([])
  })
})
