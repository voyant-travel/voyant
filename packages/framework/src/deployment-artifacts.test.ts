import { describe, expect, it } from "vitest"
import {
  buildDeploymentArtifactManifest,
  buildDeploymentGraphJson,
  buildManagedNodeRuntimeEntry,
  buildManagedNodeRuntimeEntryArtifact,
  VOYANT_DEPLOYMENT_ARTIFACTS_SCHEMA_VERSION,
  VOYANT_MANAGED_NODE_RUNTIME_ENTRY_ID,
} from "./deployment-artifacts.js"
import { defineModule, defineProject, resolveDeploymentGraph } from "./deployment-graph.js"

async function sampleGraph() {
  return resolveDeploymentGraph({
    project: defineProject({
      modules: [
        defineModule({
          id: "@acme/voyant-loyalty",
          provides: { capabilities: ["acme.loyalty.points"] },
          api: [{ id: "@acme/voyant-loyalty#api.admin", surface: "admin" }],
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
    expect(source).toContain('from "@voyant-travel/framework/managed-runtime"')
    expect(source).toContain('from "node:url"')
    expect(source).toContain("startManagedProfileRuntime")
    expect(source).not.toContain("starters/")
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
