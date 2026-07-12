import path from "node:path"

import { resolveProject } from "@voyant-travel/framework/project"
import { netopiaVoyantPlugin } from "@voyant-travel/plugin-netopia/voyant"
import { describe, expect, it } from "vitest"
import config from "./voyant.config.js"

const operatorRoot = process.cwd()

describe("Operator project config", () => {
  it("authors only deployment differences and external plugins", () => {
    expect(config.modules).toHaveLength(38)
    expect(config.extensions).toHaveLength(24)
    expect(config.plugins).toHaveLength(1)
    expect(config.productBom).toEqual({
      schemaVersion: "voyant.product-bom-reference.v1",
      id: "@voyant-travel/operator-standard",
      version: "1",
    })
    expect(config).not.toHaveProperty("presetLineage")
    expect(config.deployment?.migrations).toBeUndefined()
    expect(config.access?.presets?.map((preset) => preset.id)).toEqual([
      "agent-customer",
      "agent-staff",
      "automation",
      "catalog-read",
      "commerce-read",
      "editor",
      "full-access",
      "public-catalog-reader",
      "read-only",
    ])

    expect(config.selections?.modules).toHaveLength(38)
    expect(
      config.selections?.modules.every(({ provenance }) => provenance.kind === "package"),
    ).toBe(true)
    expect(config.selections?.extensions).toHaveLength(24)
    expect(config.selections?.plugins.map((selection) => selection.resolve)).toEqual([
      "@voyant-travel/plugin-netopia",
    ])
    expect(config.extensions.every((unit) => unit.schemaVersion === "voyant.extension.v1")).toBe(
      true,
    )
  })

  it("resolves Netopia from its package-owned Voyant manifest", async () => {
    const { graph, artifacts } = await resolveProject({
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
      version: "0.105.21",
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
    expect(graph.deployment.migrations).toBeUndefined()
    expect(
      artifacts.migrationPlan.migrations
        .filter((migration) => migration.migrationKind === "schema")
        .every((migration) => migration.source.kind === "package"),
    ).toBe(true)
    const productBom = artifacts.files.find((file) => file.path === "product-bom.generated.json")
    expect(JSON.parse(productBom?.contents ?? "null")).toMatchObject({
      schemaVersion: "voyant.product-bom-expansion.v1",
      productBom: config.productBom,
      graph: {
        contentHash: graph.contentHash,
        deploymentTarget: "node",
        modules: expect.arrayContaining(["@voyant-travel/identity"]),
        plugins: expect.arrayContaining(["@voyant-travel/plugin-netopia"]),
      },
    })
  })
})
