import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

import { loadOperatorDeploymentGraphArtifacts } from "./deployment-graph-artifacts"

const HASH = `sha256:${"a".repeat(64)}`
const OTHER_HASH = `sha256:${"b".repeat(64)}`

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("loadOperatorDeploymentGraphArtifacts", () => {
  it("loads the committed operator graph artifacts", () => {
    const summary = loadOperatorDeploymentGraphArtifacts()

    expect(summary.graphHash).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(summary.moduleIds).toContain("@voyant-travel/bookings")
    expect(summary.packageNames).toContain("@voyant-travel/framework")
  })

  it("fails when the artifact graph hash does not match the graph content hash", () => {
    const root = fixtureRoot()
    writeFixture(root, { manifestGraphHash: OTHER_HASH })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/does not match graph contentHash/)
  })

  it("fails when generated graph hashes are not sha256 content hashes", () => {
    const root = fixtureRoot()
    writeFixture(root, { graphHash: "not-a-content-hash" })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/must match sha256:<64 lowercase hex chars>/)
  })

  it("fails when the graph reports diagnostics", () => {
    const root = fixtureRoot()
    writeFixture(root, {
      diagnostics: [
        {
          code: "VOYANT_GRAPH_MISSING_CAPABILITY",
          message: "Required capability acme.crm.people is not provided.",
        },
      ],
    })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/VOYANT_GRAPH_MISSING_CAPABILITY/)
  })

  it("resolves source-style artifact paths beside src", () => {
    const root = fixtureRoot()
    writeFixture(root)

    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "src", "server.ts")).href,
    )

    expect(summary.graphHash).toBe(HASH)
    expect(summary.moduleIds).toEqual(["@voyant-travel/bookings"])
  })

  it("resolves dist-style artifact paths beside dist/server", () => {
    const root = fixtureRoot()
    writeFixture(join(root, "dist"))
    mkdirSync(join(root, "dist", "server"), { recursive: true })

    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "dist", "server", "server.js")).href,
    )

    expect(summary.graphHash).toBe(HASH)
    expect(summary.pluginIds).toEqual(["@voyant-travel/plugin-smartbill"])
  })

  it("requires the managed node runtime entry metadata", () => {
    const root = fixtureRoot()
    writeFixture(root, { runtimeEntry: { kind: "custom-node" } })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/kind must be managed-profile-node/)
  })
})

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "voyant-operator-graph-artifacts-"))
  roots.push(root)
  return root
}

function writeFixture(
  root: string,
  options: {
    manifestGraphHash?: string
    graphHash?: string
    diagnostics?: Array<{ code: string; message: string }>
    runtimeEntry?: Record<string, unknown>
  } = {},
): void {
  mkdirSync(join(root, "src"), { recursive: true })
  writeFileSync(join(root, "managed-profile.json"), "{}\n")
  const graphHash = options.graphHash ?? HASH
  writeJson(join(root, "deployment-artifacts.generated.json"), {
    schemaVersion: "voyant.deployment-artifacts.v1",
    graphHash: options.manifestGraphHash ?? graphHash,
    graph: "deployment-graph.generated.json",
    runtimeEntries: [
      {
        ...{
          id: "@voyant-travel/framework#runtime.node",
          target: "node",
          file: "src/runtime-entry.generated.ts",
          graphHash,
          kind: "managed-profile-node",
          profileSnapshot: "managed-profile.json",
        },
        ...options.runtimeEntry,
      },
    ],
  })
  writeJson(join(root, "deployment-graph.generated.json"), {
    schemaVersion: "voyant.resolved-graph.v1",
    contentHash: graphHash,
    diagnostics: options.diagnostics ?? [],
    deployment: { target: "node", mode: "self-hosted" },
    modules: [{ id: "@voyant-travel/bookings" }],
    plugins: [{ id: "@voyant-travel/plugin-smartbill" }],
    packageRecords: [{ packageName: "@voyant-travel/framework" }],
  })
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
