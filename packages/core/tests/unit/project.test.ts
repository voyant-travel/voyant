import { describe, expect, it } from "vitest"

import { defineExtension, defineModule, defineProject } from "../../src/project.js"

describe("defineProject", () => {
  it("normalizes package strings and records to the same module selection", () => {
    const fromString = defineProject({ modules: ["@acme/voyant-suite/loyalty"] })
    const fromRecord = defineProject({
      modules: [{ resolve: "@acme/voyant-suite#loyalty" }],
    })

    expect(fromString).toEqual(fromRecord)
    expect(fromString.modules).toEqual([
      {
        schemaVersion: "voyant.module.v1",
        id: "@acme/voyant-suite#loyalty",
        packageName: "@acme/voyant-suite",
      },
    ])
    expect(fromString.selections?.modules).toEqual([
      {
        id: "@acme/voyant-suite#loyalty",
        resolve: "@acme/voyant-suite#loyalty",
        packageName: "@acme/voyant-suite",
        provenance: {
          kind: "package",
          packageName: "@acme/voyant-suite",
          unitPath: "loyalty",
        },
      },
    ])
  })

  it("gives unscoped packages a canonical graph namespace without losing provenance", () => {
    const project = defineProject({ modules: ["voyant-loyalty/rewards"] })

    expect(project.modules).toEqual([
      {
        schemaVersion: "voyant.module.v1",
        id: "npm/voyant-loyalty#rewards",
        packageName: "voyant-loyalty",
      },
    ])
    expect(project.selections?.modules[0]).toMatchObject({
      id: "npm/voyant-loyalty#rewards",
      packageName: "voyant-loyalty",
      provenance: { kind: "package", packageName: "voyant-loyalty" },
    })
  })

  it("normalizes local path strings and records to stable plugin selections", () => {
    const fromString = defineProject({
      modules: [],
      plugins: ["./src/plugins/../plugins/smartbill"],
    })
    const fromRecord = defineProject({
      modules: [],
      plugins: [{ resolve: "file:./src/plugins/smartbill" }],
    })

    expect(fromString).toEqual(fromRecord)
    expect(fromString.plugins).toEqual([
      {
        schemaVersion: "voyant.plugin.v1",
        id: "local/src.plugins.smartbill",
        packageName: "local/src.plugins.smartbill",
      },
    ])
    expect(fromString.selections?.plugins).toEqual([
      {
        id: "local/src.plugins.smartbill",
        resolve: "./src/plugins/smartbill",
        packageName: "local/src.plugins.smartbill",
        provenance: { kind: "path", path: "./src/plugins/smartbill" },
      },
    ])
  })

  it("keeps package-owned extensions distinct from external plugins", () => {
    const extension = defineExtension({
      id: "@acme/voyant-suite#admin-extension",
      requires: { capabilities: ["acme.loyalty.points"] },
    })
    const project = defineProject({
      modules: [],
      extensions: [extension],
      plugins: ["@acme/voyant-tax-provider"],
    })

    expect(project.extensions).toEqual([extension])
    expect(project.extensions[0]?.schemaVersion).toBe("voyant.extension.v1")
    expect(project.plugins[0]?.schemaVersion).toBe("voyant.plugin.v1")
    expect(project.selections?.extensions).toEqual([])
    expect(project.selections?.plugins[0]?.resolve).toBe("@acme/voyant-tax-provider")
  })

  it("retains deterministic JSON config without turning it into a unit facet", () => {
    const project = defineProject({
      modules: [
        {
          resolve: "@acme/voyant-loyalty",
          config: {
            tiers: ["silver", "gold"],
            enabled: true,
            labels: { platinum: "Platinum", gold: "Gold" },
          },
        },
      ],
    })

    expect(project.modules[0]).not.toHaveProperty("config")
    expect(JSON.stringify(project.selections?.modules[0]?.config)).toBe(
      '{"enabled":true,"labels":{"gold":"Gold","platinum":"Platinum"},"tiers":["silver","gold"]}',
    )
  })

  it("preserves direct manifests for advanced authoring", () => {
    const manifest = defineModule({
      id: "@acme/voyant-loyalty",
      runtime: { entry: "./runtime", export: "createLoyaltyModule" },
      schema: [{ id: "@acme/voyant-loyalty#schema" }],
    })
    const project = defineProject({ modules: [manifest] })

    expect(project.modules[0]).toBe(manifest)
    expect(project.modules[0]?.runtime).toEqual({
      entry: "./runtime",
      export: "createLoyaltyModule",
    })
    expect(project.selections).toBeUndefined()
  })

  it("normalizes import-cheap deployment authoring data", () => {
    const project = defineProject({
      modules: [],
      deployment: {
        target: " node ",
        mode: "self-hosted",
        providers: {
          workflows: "trigger",
          database: "postgres",
        },
      },
    })

    expect(project.deployment).toEqual({
      target: "node",
      mode: "self-hosted",
      providers: {
        database: "postgres",
        workflows: "trigger",
      },
    })
  })

  it("rejects paths and config that cannot produce deterministic project metadata", () => {
    expect(() => defineProject({ modules: ["/tmp/voyant-loyalty"] })).toThrow(
      /absolute local paths are not deterministic/,
    )
    expect(() => defineProject({ modules: ["../voyant-loyalty"] })).toThrow(
      /must not escape the project/,
    )
    expect(() =>
      defineProject({
        modules: [
          {
            resolve: "@acme/voyant-loyalty",
            config: { loader: () => true } as never,
          },
        ],
      }),
    ).toThrow(/JSON-serializable values/)
    expect(() =>
      defineProject({
        modules: [
          {
            resolve: "@acme/voyant-loyalty",
            secrets: { apiToken: "not-project-config" },
          } as never,
        ],
      }),
    ).toThrow(/unsupported key "secrets"/)
    expect(() =>
      defineProject({
        modules: [],
        deployment: { providers: { database: "" } },
      }),
    ).toThrow(/deployment\.providers\.database must be a non-empty string/)
    expect(() =>
      defineProject({
        modules: [],
        deployment: { target: "cloudflare-worker" },
      } as never),
    ).toThrow(/deployment\.target must be "node"/)
  })
})
