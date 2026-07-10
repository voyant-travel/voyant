import { describe, expect, it } from "vitest"
import {
  buildDeploymentArtifactManifest,
  buildDeploymentGraphJson,
  buildGraphRuntimeModule,
  buildManagedNodeRuntimeEntry,
  buildManagedNodeRuntimeEntryArtifact,
  VOYANT_DEPLOYMENT_ARTIFACTS_SCHEMA_VERSION,
  VOYANT_MANAGED_NODE_RUNTIME_ENTRY_ID,
} from "./deployment-artifacts.js"
import {
  defineModule,
  definePlugin,
  defineProject,
  resolveDeploymentGraph,
  type VoyantGraphUnitManifest,
} from "./deployment-graph.js"

async function sampleGraph() {
  return resolveDeploymentGraph({
    project: defineProject({
      modules: [
        defineModule({
          id: "@acme/voyant-loyalty",
          provides: { capabilities: ["acme.loyalty.points"] },
          api: [
            {
              id: "@acme/voyant-loyalty#api.admin",
              surface: "admin",
              runtime: {
                entry: "@acme/voyant-loyalty/runtime-body-that-must-stay-lazy",
                export: "createLoyaltyModule",
              },
            },
          ],
        }),
      ],
    }),
    target: "node",
    mode: "self-hosted",
    packageRecords: [
      {
        packageName: "@acme/voyant-loyalty",
        version: "1.0.0",
        source: {
          kind: "registry",
          reference: "pnpm-lock:@acme/voyant-loyalty@1.0.0",
          integrity: "sha512-test",
        },
      },
    ],
  })
}

async function graphWithSelectedUnits(
  modules: readonly VoyantGraphUnitManifest[],
  plugins: readonly VoyantGraphUnitManifest[] = [],
) {
  const units = [...modules, ...plugins]
  return resolveDeploymentGraph({
    project: defineProject({ modules, plugins }),
    target: "node",
    mode: "self-hosted",
    packageRecords: [
      ...new Set(units.map((unit) => unit.packageName ?? unit.id.split("#")[0])),
    ].map((packageName) => ({
      packageName: packageName ?? "",
      source: { kind: "workspace" as const },
    })),
  })
}

describe("deployment graph artifacts", () => {
  it("builds deterministic resolved graph JSON containing the graph hash", async () => {
    const graph = await sampleGraph()
    const first = buildDeploymentGraphJson(graph)
    const second = buildDeploymentGraphJson(graph)

    expect(first).toBe(second)
    expect(first.endsWith("\n")).toBe(true)
    expect(JSON.parse(first)).toMatchObject({
      schemaVersion: "voyant.resolved-graph.v1",
      contentHash: graph.contentHash,
    })
  })

  it("builds a deployment artifact manifest with relative runtime entries", async () => {
    const graph = await sampleGraph()
    const entry = buildManagedNodeRuntimeEntryArtifact({
      graph,
      file: "src/runtime-entry.generated.ts",
      profileSnapshot: "managed-profile.json",
    })

    expect(
      buildDeploymentArtifactManifest({
        graph,
        graphArtifactPath: "deployment-graph.generated.json",
        runtimeEntries: [entry],
        migrationSources: [
          {
            packageName: "@acme/voyant-loyalty",
            schema: "../../node_modules/@acme/voyant-loyalty/dist/schema.js",
          },
        ],
      }),
    ).toEqual({
      schemaVersion: VOYANT_DEPLOYMENT_ARTIFACTS_SCHEMA_VERSION,
      graphHash: graph.contentHash,
      graph: "deployment-graph.generated.json",
      runtimeEntries: [
        {
          id: VOYANT_MANAGED_NODE_RUNTIME_ENTRY_ID,
          target: "node",
          file: "src/runtime-entry.generated.ts",
          graphHash: graph.contentHash,
          kind: "managed-profile-node",
          profileSnapshot: "managed-profile.json",
        },
      ],
      migrationSources: [
        {
          packageName: "@acme/voyant-loyalty",
          schema: "../../node_modules/@acme/voyant-loyalty/dist/schema.js",
        },
      ],
    })
  })

  it("builds a tiny managed Node runtime entry tied to the graph hash", async () => {
    const graph = await sampleGraph()
    const source = buildManagedNodeRuntimeEntry({
      graph,
      graphArtifactPath: "../deployment-graph.generated.json",
      profileSnapshotPath: "../managed-profile.json",
      command: "pnpm --filter operator graph:emit",
    })

    expect(source).toContain(`GENERATED_DEPLOYMENT_GRAPH_HASH = "${graph.contentHash}"`)
    expect(source).toContain('import { readFileSync } from "node:fs"')
    expect(source).toContain('from "node:url"')
    expect(source).toContain("assertGeneratedDeploymentGraphArtifact()")
    expect(source).toContain("resolveGeneratedDeploymentRequirements")
    expect(source).toContain("resolveGeneratedRuntimeDeployment")
    expect(source).toContain('await import("@voyant-travel/framework/managed-runtime")')
    expect(
      source.indexOf("if (isMainModule) {\n  assertGeneratedDeploymentGraphArtifact()"),
    ).toBeLessThan(source.indexOf('await import("@voyant-travel/framework/managed-runtime")'))
    expect(source).toContain("startManagedProfileRuntime")
    expect(source).toContain("deployment: resolveGeneratedRuntimeDeployment()")
    expect(source).toContain("deploymentRequirements: resolveGeneratedDeploymentRequirements()")
    expect(source).not.toContain("starters/")
  })

  it("lowers selected graph runtime references into deterministic lazy source", async () => {
    const graph = await sampleGraph()
    const first = buildGraphRuntimeModule({ graph, command: "voyant graph runtime emit" })
    const second = buildGraphRuntimeModule({ graph, command: "voyant graph runtime emit" })

    expect(first).toBe(second)
    expect(first).toContain(`GENERATED_GRAPH_RUNTIME_HASH = "${graph.contentHash}"`)
    expect(first).toContain(
      '"@acme/voyant-loyalty/runtime-body-that-must-stay-lazy": () => import("@acme/voyant-loyalty/runtime-body-that-must-stay-lazy")',
    )
    expect(first).toContain('"@acme/voyant-loyalty#api.admin"')
    expect(first).toContain('"createLoyaltyModule"')
    expect(first).toContain("createGeneratedGraphRuntime")
    expect(first).not.toContain("FRAMEWORK_RUNTIME_MANIFEST")
  })

  it("removes package importers and loaders when the package is not selected", async () => {
    const loyalty = defineModule({
      id: "@acme/voyant-loyalty",
      api: [
        {
          id: "@acme/voyant-loyalty#api.admin",
          surface: "admin",
          runtime: { entry: "@acme/voyant-loyalty", export: "loyaltyModule" },
        },
      ],
    })
    const crm = defineModule({
      id: "@acme/voyant-crm",
      api: [
        {
          id: "@acme/voyant-crm#api.admin",
          surface: "admin",
          runtime: { entry: "@acme/voyant-crm", export: "crmModule" },
        },
      ],
    })
    const auditPlugin = definePlugin({
      id: "@acme/voyant-loyalty#audit-plugin",
      api: [
        {
          id: "@acme/voyant-loyalty#audit-plugin.api",
          surface: "internal",
          runtime: { entry: "./audit-runtime", export: "auditExtension" },
        },
      ],
    })

    const complete = buildGraphRuntimeModule({
      graph: await graphWithSelectedUnits([loyalty, crm], [auditPlugin]),
    })
    const withoutCrm = buildGraphRuntimeModule({
      graph: await graphWithSelectedUnits([loyalty], [auditPlugin]),
    })

    expect(complete).toContain('import("@acme/voyant-crm")')
    expect(complete).toContain('"@acme/voyant-crm#api.admin"')
    expect(withoutCrm).not.toContain("@acme/voyant-crm")
    expect(withoutCrm).toContain('import("@acme/voyant-loyalty")')
    expect(withoutCrm).toContain('import("@acme/voyant-loyalty/audit-runtime")')
    expect(withoutCrm).toContain('kind": "plugin"')
  })

  it("does not import package runtime bodies during graph resolution or generation", async () => {
    const graph = await sampleGraph()

    await expect(sampleGraph()).resolves.toEqual(graph)
    expect(() => buildGraphRuntimeModule({ graph })).not.toThrow()
  })

  it("refuses to emit runtime imports for a graph with unadmitted references", async () => {
    const graph = await resolveDeploymentGraph({
      project: defineProject({
        modules: [
          defineModule({
            id: "@acme/voyant-loyalty",
            api: [
              {
                id: "@acme/voyant-loyalty#api.admin",
                surface: "admin",
                runtime: { entry: "@unknown/runtime", export: "routes" },
              },
            ],
          }),
        ],
      }),
      packageRecords: [{ packageName: "@acme/voyant-loyalty", source: { kind: "workspace" } }],
    })

    expect(() => buildGraphRuntimeModule({ graph })).toThrow(
      /VOYANT_GRAPH_RUNTIME_PACKAGE_UNADMITTED/,
    )
  })

  it("rejects absolute artifact paths", async () => {
    const graph = await sampleGraph()

    expect(() =>
      buildManagedNodeRuntimeEntryArtifact({
        graph,
        file: "/tmp/runtime-entry.generated.ts",
        profileSnapshot: "managed-profile.json",
      }),
    ).toThrow(/relative path/)
  })

  it("rejects runtime entry artifacts with a mismatched graph hash", async () => {
    const graph = await sampleGraph()
    const entry = buildManagedNodeRuntimeEntryArtifact({
      graph,
      file: "src/runtime-entry.generated.ts",
      profileSnapshot: "managed-profile.json",
    })

    expect(() =>
      buildDeploymentArtifactManifest({
        graph,
        graphArtifactPath: "deployment-graph.generated.json",
        runtimeEntries: [{ ...entry, graphHash: "sha256:stale" }],
      }),
    ).toThrow(/graphHash must match/)
  })
})
