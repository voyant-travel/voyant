import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

import {
  assertOperatorDeploymentGraphResourceEnv,
  loadOperatorDeploymentGraphArtifacts,
  validateOperatorDeploymentGraphResourceEnv,
} from "./deployment-graph-artifacts"

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
    expect(summary.resourceRequirements.map((resource) => resource.resourceKey)).toContain(
      "database:postgres",
    )
  })

  it("fails when the artifact graph hash does not match the graph content hash", () => {
    const root = fixtureRoot()
    writeFixture(root, { manifestGraphHash: OTHER_HASH })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/does not match graph contentHash/)
  })

  it("fails when the graph content hash does not match the canonical graph body", () => {
    const root = fixtureRoot()
    writeFixture(root)
    const graphPath = join(root, "deployment-graph.generated.json")
    const graph = JSON.parse(readFileSync(graphPath, "utf8")) as FixtureDeploymentGraph
    graph.modules.push({ id: "@voyant-travel/catalog" })
    writeJson(graphPath, graph)

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/does not match canonical graph hash/)
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

  it("fails when the graph omits resource requirements", () => {
    const root = fixtureRoot()
    writeFixture(root, { omitRequirements: true })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/deployment graph requirements must be an object/)
  })

  it("reports missing required resource environment before boot", () => {
    const root = fixtureRoot()
    writeFixture(root)
    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "src", "server.ts")).href,
    )

    expect(validateOperatorDeploymentGraphResourceEnv(summary, {})).toEqual([
      "secret DATABASE_URL is required for database:postgres",
    ])
    expect(validateOperatorDeploymentGraphResourceEnv(summary, { DATABASE_URL: "   " })).toEqual([
      "secret DATABASE_URL is required for database:postgres",
    ])
    expect(() => assertOperatorDeploymentGraphResourceEnv(summary, {})).toThrow(
      /Operator deployment graph resource requirements are not satisfied:\n- secret DATABASE_URL is required for database:postgres/,
    )
  })

  it("accepts satisfied required resource environment before boot", () => {
    const root = fixtureRoot()
    writeFixture(root)
    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "src", "server.ts")).href,
    )

    expect(
      validateOperatorDeploymentGraphResourceEnv(summary, {
        DATABASE_URL: "postgres://user:pass@example.test:5432/voyant",
      }),
    ).toEqual([])
    expect(() =>
      assertOperatorDeploymentGraphResourceEnv(summary, {
        DATABASE_URL: "postgres://user:pass@example.test:5432/voyant",
      }),
    ).not.toThrow()
  })

  it("resolves source-style artifact paths beside src", () => {
    const root = fixtureRoot()
    const graphHash = writeFixture(root)

    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "src", "server.ts")).href,
    )

    expect(summary.graphHash).toBe(graphHash)
    expect(summary.moduleIds).toEqual(["@voyant-travel/bookings"])
  })

  it("resolves dist-style artifact paths beside dist/server", () => {
    const root = fixtureRoot()
    const graphHash = writeFixture(join(root, "dist"), { writeRuntimeEntrySource: false })
    mkdirSync(join(root, "dist", "server"), { recursive: true })

    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "dist", "server", "server.js")).href,
    )

    expect(summary.graphHash).toBe(graphHash)
    expect(summary.pluginIds).toEqual(["@voyant-travel/plugin-smartbill"])
  })

  it("requires the managed node runtime entry metadata", () => {
    const root = fixtureRoot()
    writeFixture(root, { runtimeEntry: { kind: "custom-node" } })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/kind must be managed-profile-node/)
  })

  it("fails when generated runtime entry constants drift from the graph", () => {
    const root = fixtureRoot()
    writeFixture(root, { runtimeEntrySource: { graphHash: OTHER_HASH } })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/GENERATED_DEPLOYMENT_GRAPH_HASH/)
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
    requirements?: FixtureDeploymentGraph["requirements"]
    omitRequirements?: boolean
    runtimeEntry?: Record<string, unknown>
    runtimeEntrySource?: { graphHash?: string }
    writeRuntimeEntrySource?: boolean
  } = {},
): string {
  mkdirSync(join(root, "src"), { recursive: true })
  writeFileSync(join(root, "managed-profile.json"), "{}\n")
  const graphWithoutHash: Omit<FixtureDeploymentGraph, "contentHash"> = {
    schemaVersion: "voyant.resolved-graph.v1",
    diagnostics: options.diagnostics ?? [],
    deployment: { target: "node", mode: "self-hosted" },
    ...(!options.omitRequirements && options.requirements !== undefined
      ? { requirements: options.requirements }
      : !options.omitRequirements
        ? {
            requirements: {
              resources: [
                {
                  resourceKey: "database:postgres",
                  roles: ["database"],
                  provider: "postgres",
                  required: true,
                  env: [
                    {
                      name: "DATABASE_URL",
                      kind: "secret",
                      required: true,
                      description: "Primary Postgres connection URL.",
                    },
                  ],
                },
              ],
            },
          }
        : {}),
    modules: [{ id: "@voyant-travel/bookings" }],
    plugins: [{ id: "@voyant-travel/plugin-smartbill" }],
    packageRecords: [{ packageName: "@voyant-travel/framework" }],
  }
  const graphHash = options.graphHash ?? computeGraphContentHash(graphWithoutHash)
  const graph: FixtureDeploymentGraph = { ...graphWithoutHash, contentHash: graphHash }
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
  writeJson(join(root, "deployment-graph.generated.json"), graph)
  if (options.writeRuntimeEntrySource !== false) {
    writeGeneratedRuntimeEntrySource(root, graph, {
      graphHash: options.runtimeEntrySource?.graphHash ?? graphHash,
    })
  }
  return graphHash
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

interface FixtureDeploymentGraph {
  schemaVersion: string
  contentHash: string
  diagnostics: Array<{ code: string; message: string }>
  deployment: { target: string; mode: string }
  requirements?: {
    resources: Array<{
      resourceKey: string
      roles: string[]
      provider: string
      required: boolean
      env: Array<{ name: string; kind: string; required: boolean; description: string }>
    }>
  }
  modules: Array<{ id: string }>
  plugins: Array<{ id: string }>
  packageRecords: Array<{ packageName: string }>
}

function writeGeneratedRuntimeEntrySource(
  root: string,
  graph: FixtureDeploymentGraph,
  options: { graphHash: string },
): void {
  writeFileSync(
    join(root, "src", "runtime-entry.generated.ts"),
    [
      `export const GENERATED_DEPLOYMENT_GRAPH_SCHEMA_VERSION = ${JSON.stringify(
        graph.schemaVersion,
      )} as const`,
      `export const GENERATED_DEPLOYMENT_GRAPH_HASH = ${JSON.stringify(options.graphHash)} as const`,
      `export const GENERATED_DEPLOYMENT_GRAPH_TARGET = ${JSON.stringify(
        graph.deployment.target,
      )} as const`,
      `export const GENERATED_DEPLOYMENT_GRAPH_MODE = ${JSON.stringify(
        graph.deployment.mode,
      )} as const`,
      'export const GENERATED_DEPLOYMENT_GRAPH_ARTIFACT_PATH = "../deployment-graph.generated.json" as const',
      'export const GENERATED_MANAGED_PROFILE_SNAPSHOT_PATH = "../managed-profile.json" as const',
      `export const GENERATED_DEPLOYMENT_GRAPH_MODULE_IDS = ${stringArrayLiteral(
        graph.modules.map((module) => module.id),
      )} as const`,
      `export const GENERATED_DEPLOYMENT_GRAPH_PLUGIN_IDS = ${stringArrayLiteral(
        graph.plugins.map((plugin) => plugin.id),
      )} as const`,
      `export const GENERATED_DEPLOYMENT_GRAPH_PACKAGE_NAMES = ${stringArrayLiteral(
        graph.packageRecords.map((record) => record.packageName),
      )} as const`,
      "",
    ].join("\n"),
  )
}

function stringArrayLiteral(values: readonly string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`
}

function computeGraphContentHash(graphWithoutHash: Omit<FixtureDeploymentGraph, "contentHash">) {
  return `sha256:${createHash("sha256").update(canonicalJson(graphWithoutHash)).digest("hex")}`
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return null
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(canonicalize)

  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    sorted[key] = canonicalize((value as Record<string, unknown>)[key])
  }
  return sorted
}
