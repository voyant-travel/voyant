import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ARTIFACT_MANIFEST_SCHEMA_VERSION = "voyant.deployment-artifacts.v1"
const RESOLVED_GRAPH_SCHEMA_VERSION = "voyant.resolved-graph.v1"
const ARTIFACT_MANIFEST_FILENAME = "../deployment-artifacts.generated.json"
const EXPECTED_GRAPH_ARTIFACT = "deployment-graph.generated.json"
const EXPECTED_NODE_RUNTIME_ENTRY_ID = "@voyant-travel/framework#runtime.node"
const EXPECTED_NODE_RUNTIME_ENTRY_FILE = "src/runtime-entry.generated.ts"
const EXPECTED_NODE_RUNTIME_ENTRY_KIND = "managed-profile-node"
const EXPECTED_PROFILE_SNAPSHOT = "managed-profile.json"
const SHA256_CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/

export interface OperatorDeploymentGraphArtifactSummary {
  graphHash: string
  moduleIds: readonly string[]
  pluginIds: readonly string[]
  packageNames: readonly string[]
}

interface DeploymentArtifactManifest {
  schemaVersion?: unknown
  graphHash?: unknown
  graph?: unknown
  runtimeEntries?: unknown
}

interface RuntimeEntryArtifact {
  id?: unknown
  target?: unknown
  file?: unknown
  graphHash?: unknown
  kind?: unknown
  profileSnapshot?: unknown
}

interface ResolvedDeploymentGraph {
  schemaVersion?: unknown
  contentHash?: unknown
  diagnostics?: unknown
  deployment?: unknown
  modules?: unknown
  plugins?: unknown
  packageRecords?: unknown
}

export function loadOperatorDeploymentGraphArtifacts(
  baseUrl = import.meta.url,
): OperatorDeploymentGraphArtifactSummary {
  const manifestUrl = new URL(ARTIFACT_MANIFEST_FILENAME, baseUrl)
  const manifest = readJsonFile<DeploymentArtifactManifest>(manifestUrl, "deployment artifacts")

  if (manifest.schemaVersion !== ARTIFACT_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `deployment artifacts schema must be ${ARTIFACT_MANIFEST_SCHEMA_VERSION}, got ${String(
        manifest.schemaVersion,
      )}`,
    )
  }
  const manifestGraphHash = requireSha256ContentHash(
    manifest.graphHash,
    "deployment artifacts graphHash",
  )
  const graphPath = requireString(manifest.graph, "deployment artifacts graph")
  if (graphPath !== EXPECTED_GRAPH_ARTIFACT) {
    throw new Error(
      `deployment artifacts graph must be ${EXPECTED_GRAPH_ARTIFACT}, got ${graphPath}`,
    )
  }
  const graphUrl = relativeArtifactUrl(graphPath, manifestUrl)
  const graph = readJsonFile<ResolvedDeploymentGraph>(graphUrl, "deployment graph")

  if (graph.schemaVersion !== RESOLVED_GRAPH_SCHEMA_VERSION) {
    throw new Error(
      `deployment graph schema must be ${RESOLVED_GRAPH_SCHEMA_VERSION}, got ${String(
        graph.schemaVersion,
      )}`,
    )
  }
  const graphHash = requireSha256ContentHash(graph.contentHash, "deployment graph contentHash")
  if (manifestGraphHash !== graphHash) {
    throw new Error(
      `deployment artifact graphHash ${manifestGraphHash} does not match graph contentHash ${graphHash}`,
    )
  }

  const target = graphDeploymentTarget(graph)
  if (target !== "node") {
    throw new Error(`operator deployment graph target must be node, got ${String(target)}`)
  }

  const diagnostics = arrayOfRecords(graph.diagnostics, "deployment graph diagnostics")
  if (diagnostics.length > 0) {
    const details = diagnostics
      .map((diagnostic) =>
        [
          stringField(diagnostic, "code") ?? "unknown",
          stringField(diagnostic, "message") ?? "deployment graph diagnostic",
        ].join(": "),
      )
      .join("; ")
    throw new Error(`deployment graph has diagnostics: ${details}`)
  }

  const runtimeEntries = arrayOfRecords(
    manifest.runtimeEntries,
    "deployment artifacts runtimeEntries",
  ) as RuntimeEntryArtifact[]
  if (runtimeEntries.length === 0) {
    throw new Error("deployment artifacts must include at least one runtime entry")
  }

  let hasExpectedNodeRuntimeEntry = false
  for (const entry of runtimeEntries) {
    const id = requireString(entry.id, "runtime entry id")
    const entryTarget = requireString(entry.target, `runtime entry ${id} target`)
    const entryFile = requireString(entry.file, `runtime entry ${id} file`)
    const entryKind = requireString(entry.kind, `runtime entry ${id} kind`)
    const entryGraphHash = requireSha256ContentHash(
      entry.graphHash,
      `runtime entry ${id} graphHash`,
    )
    if (entryGraphHash !== graphHash) {
      throw new Error(
        `runtime entry ${id} graphHash ${entryGraphHash} does not match graph contentHash ${graphHash}`,
      )
    }

    const profileSnapshot = requireString(
      entry.profileSnapshot,
      `runtime entry ${id} profileSnapshot`,
    )
    if (id === EXPECTED_NODE_RUNTIME_ENTRY_ID) {
      if (entryTarget !== "node") {
        throw new Error(`runtime entry ${id} target must be node, got ${entryTarget}`)
      }
      if (entryFile !== EXPECTED_NODE_RUNTIME_ENTRY_FILE) {
        throw new Error(
          `runtime entry ${id} file must be ${EXPECTED_NODE_RUNTIME_ENTRY_FILE}, got ${entryFile}`,
        )
      }
      if (entryKind !== EXPECTED_NODE_RUNTIME_ENTRY_KIND) {
        throw new Error(
          `runtime entry ${id} kind must be ${EXPECTED_NODE_RUNTIME_ENTRY_KIND}, got ${entryKind}`,
        )
      }
      if (profileSnapshot !== EXPECTED_PROFILE_SNAPSHOT) {
        throw new Error(
          `runtime entry ${id} profileSnapshot must be ${EXPECTED_PROFILE_SNAPSHOT}, got ${profileSnapshot}`,
        )
      }
      hasExpectedNodeRuntimeEntry = true
    }

    const profileUrl = relativeArtifactUrl(profileSnapshot, manifestUrl)
    if (!existsSync(fileURLToPath(profileUrl))) {
      throw new Error(`runtime entry ${id} profile snapshot is missing: ${profileSnapshot}`)
    }
  }
  if (!hasExpectedNodeRuntimeEntry) {
    throw new Error(
      `deployment artifacts must include the managed node runtime entry ${EXPECTED_NODE_RUNTIME_ENTRY_ID}`,
    )
  }

  return {
    graphHash,
    moduleIds: collectStringField(graph.modules, "deployment graph modules", "id"),
    pluginIds: collectStringField(graph.plugins, "deployment graph plugins", "id"),
    packageNames: collectStringField(
      graph.packageRecords,
      "deployment graph packageRecords",
      "packageName",
    ),
  }
}

function readJsonFile<T>(url: URL, label: string): T {
  const file = fileURLToPath(url)
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T
  } catch (error) {
    throw new Error(`could not read ${label} at ${file}: ${reason(error)}`)
  }
}

function relativeArtifactUrl(value: string, baseUrl: URL): URL {
  if (value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || value.includes("\\")) {
    throw new Error(`deployment artifact paths must be relative POSIX paths, got ${value}`)
  }
  return new URL(value, baseUrl)
}

function graphDeploymentTarget(graph: ResolvedDeploymentGraph): string | undefined {
  const deployment = graph.deployment
  return deployment && typeof deployment === "object"
    ? stringField(deployment as Record<string, unknown>, "target")
    : undefined
}

function requireString(value: unknown, label: string): string {
  if (typeof value === "string" && value.length > 0) return value
  throw new Error(`${label} must be a non-empty string`)
}

function requireSha256ContentHash(value: unknown, label: string): string {
  const hash = requireString(value, label)
  if (SHA256_CONTENT_HASH_PATTERN.test(hash)) return hash
  throw new Error(`${label} must match sha256:<64 lowercase hex chars>, got ${hash}`)
}

function arrayOfRecords(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value.map((entry, index) => {
    if (entry && typeof entry === "object") return entry as Record<string, unknown>
    throw new Error(`${label}[${index}] must be an object`)
  })
}

function collectStringField(value: unknown, label: string, field: string): string[] {
  return arrayOfRecords(value, label).map((entry, index) =>
    requireString(entry[field], `${label}[${index}].${field}`),
  )
}

function stringField(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field]
  return typeof value === "string" ? value : undefined
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
