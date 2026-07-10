import { describe, expect, it } from "vitest"

import { defineModule, defineProject } from "../../src/project.js"

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
      schema: [{ id: "@acme/voyant-loyalty#schema" }],
    })
    const project = defineProject({ modules: [manifest] })

    expect(project.modules[0]).toBe(manifest)
    expect(project.selections).toBeUndefined()
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
  })
})
