// agent-quality: file-size exception -- owner: operator; graph artifact parsing and pre-boot validation stay co-located so the generated deployment contract has one trusted reader.
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ARTIFACT_MANIFEST_SCHEMA_VERSION = "voyant.deployment-artifacts.v1"
const RESOLVED_GRAPH_SCHEMA_VERSION = "voyant.resolved-graph.v1"
const ARTIFACT_MANIFEST_FILENAME = "../.voyant/deployment-artifacts.generated.json"
const EXPECTED_GRAPH_ARTIFACT = "./deployment-graph.generated.json"
const EXPECTED_NODE_RUNTIME_ENTRY_ID = "@voyant-travel/framework#runtime.node"
const EXPECTED_NODE_RUNTIME_ENTRY_FILE = "./runtime-entry.generated.ts"
const EXPECTED_GRAPH_RUNTIME_FILE = "runtime/graph-runtime.generated.ts"
const EXPECTED_NODE_RUNTIME_ENTRY_KIND = "node"
const EXPECTED_RUNTIME_ENTRY_GRAPH_ARTIFACT_PATH = "./deployment-graph.generated.json"
const SHA256_CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/

export interface OperatorDeploymentGraphArtifactSummary {
  graphHash: string
  moduleIds: readonly string[]
  extensionIds: readonly string[]
  pluginIds: readonly string[]
  packageNames: readonly string[]
  providers: Readonly<Record<string, string>>
  resourceRequirements: readonly OperatorDeploymentGraphResourceRequirement[]
  scheduledJobs: readonly OperatorDeploymentGraphScheduledJob[]
  migrationSources: readonly OperatorDeploymentGraphMigrationSource[]
}

export interface OperatorDeploymentGraphScheduledJob {
  id: string
  cron: string
  description: string
  route: string
  module: string
  workflowId?: string
  input?: unknown
}

export interface OperatorDeploymentGraphResourceRequirement {
  resourceKey: string
  roles: readonly string[]
  provider: string
  required: boolean
  env: readonly OperatorDeploymentGraphEnvRequirement[]
  notes?: string
}

export interface OperatorDeploymentGraphMigrationSource {
  packageName: string
  schema: string
}

export interface OperatorDeploymentGraphEnvRequirement {
  name: string
  aliases?: readonly string[]
  format?: "postgres-url" | "redis-url" | "http-url"
  kind: string
  required: boolean
  description: string
}

export type OperatorDeploymentGraphEnv = Record<string, unknown>

interface DeploymentArtifactManifest {
  schemaVersion?: unknown
  graphHash?: unknown
  graph?: unknown
  runtimeEntries?: unknown
  migrationSources?: unknown
}

interface RuntimeEntryArtifact {
  id?: unknown
  target?: unknown
  file?: unknown
  graphHash?: unknown
  kind?: unknown
}

interface ResolvedDeploymentGraph {
  schemaVersion?: unknown
  contentHash?: unknown
  diagnostics?: unknown
  deployment?: unknown
  requirements?: unknown
  provisioning?: unknown
  modules?: unknown
  extensions?: unknown
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
  const canonicalGraphHash = computeGraphContentHash(graph)
  if (graphHash !== canonicalGraphHash) {
    throw new Error(
      `deployment graph contentHash ${graphHash} does not match canonical graph hash ${canonicalGraphHash}`,
    )
  }

  const target = graphDeploymentTarget(graph)
  if (target !== "node") {
    throw new Error(`operator deployment graph target must be node, got ${String(target)}`)
  }
  const mode = graphDeploymentMode(graph)

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
      hasExpectedNodeRuntimeEntry = true
    }
  }
  if (!hasExpectedNodeRuntimeEntry) {
    throw new Error(
      `deployment artifacts must include the managed node runtime entry ${EXPECTED_NODE_RUNTIME_ENTRY_ID}`,
    )
  }

  const packageNames = collectStringField(
    graph.packageRecords,
    "deployment graph packageRecords",
    "packageName",
  )
  const migrationSources = collectMigrationSources(manifest.migrationSources, packageNames)

  const summary = {
    graphHash,
    moduleIds: collectStringField(graph.modules, "deployment graph modules", "id"),
    extensionIds:
      graph.extensions === undefined
        ? []
        : collectStringField(graph.extensions, "deployment graph extensions", "id"),
    pluginIds: collectStringField(graph.plugins, "deployment graph plugins", "id"),
    packageNames,
    providers: collectDeploymentProviders(graph.deployment),
    resourceRequirements: collectResourceRequirements(graph.requirements),
    scheduledJobs: collectScheduledJobs(graph.provisioning),
    migrationSources,
  }

  validateGeneratedRuntimeEntrySource({ graphHash, manifestUrl, mode, summary, target })
  validateGeneratedGraphRuntimeSource({ graphHash, manifestUrl, summary })

  return summary
}

export function validateOperatorDeploymentGraphResourceEnv(
  summary: Pick<OperatorDeploymentGraphArtifactSummary, "resourceRequirements">,
  env: OperatorDeploymentGraphEnv,
): string[] {
  const issues: string[] = []
  for (const resource of summary.resourceRequirements) {
    for (const requirement of resource.env) {
      const values = [requirement.name, ...(requirement.aliases ?? [])]
        .map((name) => env[name])
        .filter(hasValue)
      if (requirement.required && values.length === 0) {
        issues.push(
          `${requirement.kind} ${requirement.name} is required for ${resource.resourceKey}`,
        )
        continue
      }
      const format = requirement.format
      if (format && values.length > 0 && !values.every((value) => hasFormat(value, format))) {
        issues.push(
          `${requirement.kind} ${requirement.name} must be ${formatDescription(format)} for ${resource.resourceKey}`,
        )
      }
    }
  }
  return [...new Set(issues)]
}

export function assertOperatorDeploymentGraphResourceEnv(
  summary: Pick<OperatorDeploymentGraphArtifactSummary, "resourceRequirements">,
  env: OperatorDeploymentGraphEnv,
): void {
  const issues = validateOperatorDeploymentGraphResourceEnv(summary, env)
  if (issues.length === 0) return
  throw new Error(
    `Operator deployment graph resource requirements are not satisfied:\n${formatIssues(issues)}`,
  )
}

function collectScheduledJobs(value: unknown): OperatorDeploymentGraphScheduledJob[] {
  if (value == null) {
    throw new Error(
      "deployment graph provisioning is missing; regenerate deployment graph artifacts",
    )
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("deployment graph provisioning must be an object")
  }
  const jobs = arrayOfRecords(
    (value as Record<string, unknown>).scheduledJobs,
    "deployment graph provisioning.scheduledJobs",
  )
  return jobs.map((job, index) => ({
    id: requireString(job.id, `deployment graph provisioning.scheduledJobs[${index}].id`),
    cron: requireString(job.cron, `deployment graph provisioning.scheduledJobs[${index}].cron`),
    description: requireString(
      job.description,
      `deployment graph provisioning.scheduledJobs[${index}].description`,
    ),
    route: requireString(job.route, `deployment graph provisioning.scheduledJobs[${index}].route`),
    module: requireString(
      job.module,
      `deployment graph provisioning.scheduledJobs[${index}].module`,
    ),
    ...(typeof job.workflowId === "string" ? { workflowId: job.workflowId } : {}),
    ...(Object.hasOwn(job, "input") ? { input: job.input } : {}),
  }))
}

function collectMigrationSources(
  value: unknown,
  packageNames: readonly string[],
): OperatorDeploymentGraphMigrationSource[] {
  const knownPackages = new Set(packageNames)
  return arrayOfRecords(value, "deployment artifacts migrationSources").map((source, index) => {
    const packageName = requireString(
      source.packageName,
      `deployment artifacts migrationSources[${index}].packageName`,
    )
    if (!knownPackages.has(packageName)) {
      throw new Error(
        `deployment artifacts migrationSources[${index}].packageName ${packageName} is not present in deployment graph packageRecords`,
      )
    }
    const schema = requireString(
      source.schema,
      `deployment artifacts migrationSources[${index}].schema`,
    )
    assertRelativePosixPath(schema, `deployment artifacts migrationSources[${index}].schema`)
    return { packageName, schema }
  })
}

function collectResourceRequirements(value: unknown): OperatorDeploymentGraphResourceRequirement[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("deployment graph requirements must be an object")
  }
  const resources = arrayOfRecords(
    (value as Record<string, unknown>).resources,
    "deployment graph requirements.resources",
  )
  return resources.map((resource, index) => {
    const resourceKey = requireString(
      resource.resourceKey,
      `deployment graph requirements.resources[${index}].resourceKey`,
    )
    const provider = requireString(
      resource.provider,
      `deployment graph requirements.resources[${index}].provider`,
    )
    const required = requireBoolean(
      resource.required,
      `deployment graph requirements.resources[${index}].required`,
    )
    const roles = collectStringArray(
      resource.roles,
      `deployment graph requirements.resources[${index}].roles`,
    )
    const env = arrayOfRecords(
      resource.env,
      `deployment graph requirements.resources[${index}].env`,
    ).map((entry, envIndex) => ({
      name: requireString(
        entry.name,
        `deployment graph requirements.resources[${index}].env[${envIndex}].name`,
      ),
      ...(entry.aliases === undefined
        ? {}
        : {
            aliases: collectStringArray(
              entry.aliases,
              `deployment graph requirements.resources[${index}].env[${envIndex}].aliases`,
            ),
          }),
      ...(entry.format === undefined
        ? {}
        : {
            format: requireEnvFormat(
              entry.format,
              `deployment graph requirements.resources[${index}].env[${envIndex}].format`,
            ),
          }),
      kind: requireString(
        entry.kind,
        `deployment graph requirements.resources[${index}].env[${envIndex}].kind`,
      ),
      required: requireBoolean(
        entry.required,
        `deployment graph requirements.resources[${index}].env[${envIndex}].required`,
      ),
      description: requireString(
        entry.description,
        `deployment graph requirements.resources[${index}].env[${envIndex}].description`,
      ),
    }))
    const notes = stringField(resource, "notes")
    return {
      resourceKey,
      roles,
      provider,
      required,
      env,
      ...(notes ? { notes } : {}),
    }
  })
}

function collectDeploymentProviders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("deployment graph deployment must be an object")
  }
  const providers = (value as Record<string, unknown>).providers
  if (!providers || typeof providers !== "object" || Array.isArray(providers)) {
    throw new Error("deployment graph deployment.providers must be an object")
  }

  const collected: Record<string, string> = {}
  for (const [role, provider] of Object.entries(providers)) {
    if (typeof provider !== "string" || provider.length === 0) {
      throw new Error(`deployment graph deployment.providers.${role} must be a non-empty string`)
    }
    collected[role] = provider
  }
  return collected
}

function readJsonFile<T>(url: URL, label: string): T {
  const file = fileURLToPath(url)
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T
  } catch (error) {
    throw new Error(`could not read ${label} at ${file}: ${reason(error)}`)
  }
}

function hasValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined
}

function hasFormat(
  value: unknown,
  format: NonNullable<OperatorDeploymentGraphEnvRequirement["format"]>,
): boolean {
  if (typeof value !== "string" || value.trim().length === 0) return false
  try {
    const parsed = new URL(value)
    if (format === "postgres-url")
      return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:"
    if (format === "redis-url") return parsed.protocol === "redis:" || parsed.protocol === "rediss:"
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

function formatDescription(
  format: NonNullable<OperatorDeploymentGraphEnvRequirement["format"]>,
): string {
  if (format === "postgres-url") return "a Postgres URL"
  if (format === "redis-url") return "a Redis URL"
  return "an HTTP(S) URL"
}

function requireEnvFormat(
  value: unknown,
  label: string,
): NonNullable<OperatorDeploymentGraphEnvRequirement["format"]> {
  if (value === "postgres-url" || value === "redis-url" || value === "http-url") return value
  throw new Error(`${label} must be a supported environment value format`)
}

function relativeArtifactUrl(value: string, baseUrl: URL): URL {
  assertRelativePosixPath(value, "deployment artifact paths")
  return new URL(value, baseUrl)
}

function assertRelativePosixPath(value: string, label: string): void {
  if (value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || value.includes("\\")) {
    throw new Error(`${label} must be relative POSIX paths, got ${value}`)
  }
}

function graphDeploymentTarget(graph: ResolvedDeploymentGraph): string | undefined {
  const deployment = graph.deployment
  return deployment && typeof deployment === "object"
    ? stringField(deployment as Record<string, unknown>, "target")
    : undefined
}

function graphDeploymentMode(graph: ResolvedDeploymentGraph): string | undefined {
  const deployment = graph.deployment
  return deployment && typeof deployment === "object"
    ? stringField(deployment as Record<string, unknown>, "mode")
    : undefined
}

function computeGraphContentHash(graph: ResolvedDeploymentGraph): string {
  const { contentHash: _contentHash, ...graphWithoutHash } = graph
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

function validateGeneratedRuntimeEntrySource(input: {
  graphHash: string
  manifestUrl: URL
  mode: string | undefined
  summary: OperatorDeploymentGraphArtifactSummary
  target: string
}): void {
  const runtimeEntryUrl = relativeArtifactUrl(EXPECTED_NODE_RUNTIME_ENTRY_FILE, input.manifestUrl)
  const runtimeEntryFile = fileURLToPath(runtimeEntryUrl)
  if (!existsSync(runtimeEntryFile)) return

  const source = readFileSync(runtimeEntryFile, "utf8")
  assertGeneratedStringConst(
    source,
    "GENERATED_DEPLOYMENT_GRAPH_SCHEMA_VERSION",
    RESOLVED_GRAPH_SCHEMA_VERSION,
  )
  assertGeneratedStringConst(source, "GENERATED_DEPLOYMENT_GRAPH_HASH", input.graphHash)
  assertGeneratedStringConst(source, "GENERATED_DEPLOYMENT_GRAPH_TARGET", input.target)
  assertGeneratedStringConst(source, "GENERATED_DEPLOYMENT_GRAPH_MODE", input.mode)
  assertGeneratedStringConst(
    source,
    "GENERATED_DEPLOYMENT_GRAPH_ARTIFACT_PATH",
    EXPECTED_RUNTIME_ENTRY_GRAPH_ARTIFACT_PATH,
  )
  assertGeneratedStringArrayConst(
    source,
    "GENERATED_DEPLOYMENT_GRAPH_MODULE_IDS",
    input.summary.moduleIds,
  )
  assertGeneratedExtensionIds(
    source,
    "GENERATED_DEPLOYMENT_GRAPH_EXTENSION_IDS",
    input.summary.extensionIds,
  )
  assertGeneratedStringArrayConst(
    source,
    "GENERATED_DEPLOYMENT_GRAPH_PLUGIN_IDS",
    input.summary.pluginIds,
  )
  assertGeneratedStringArrayConst(
    source,
    "GENERATED_DEPLOYMENT_GRAPH_PACKAGE_NAMES",
    input.summary.packageNames,
  )
}

function validateGeneratedGraphRuntimeSource(input: {
  graphHash: string
  manifestUrl: URL
  summary: OperatorDeploymentGraphArtifactSummary
}): void {
  const runtimeUrl = relativeArtifactUrl(EXPECTED_GRAPH_RUNTIME_FILE, input.manifestUrl)
  const runtimeFile = fileURLToPath(runtimeUrl)
  if (!existsSync(runtimeFile)) return

  const source = readFileSync(runtimeFile, "utf8")
  assertGeneratedStringConst(source, "GENERATED_GRAPH_RUNTIME_HASH", input.graphHash)
  assertGeneratedStringArrayConst(
    source,
    "GENERATED_GRAPH_RUNTIME_MODULE_IDS",
    input.summary.moduleIds,
  )
  assertGeneratedExtensionIds(
    source,
    "GENERATED_GRAPH_RUNTIME_EXTENSION_IDS",
    input.summary.extensionIds,
  )
  assertGeneratedStringArrayConst(
    source,
    "GENERATED_GRAPH_RUNTIME_PLUGIN_IDS",
    input.summary.pluginIds,
  )
}

function assertGeneratedStringConst(source: string, name: string, expected: string | undefined) {
  const actual = parseGeneratedStringConst(source, name)
  if (actual === expected) return
  throw new Error(
    `generated runtime entry ${name} must be ${String(expected)}, got ${String(actual)}`,
  )
}

function assertGeneratedExtensionIds(
  source: string,
  name: string,
  expected: readonly string[],
): void {
  if (expected.length === 0 && !source.includes(name)) return
  assertGeneratedStringArrayConst(source, name, expected)
}

function parseGeneratedStringConst(source: string, name: string): string | undefined {
  const escapedName = escapeRegExp(name)
  const match = source.match(
    new RegExp(`export\\s+const\\s+${escapedName}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")\\s+as\\s+const`),
  )
  if (!match) return undefined
  return JSON.parse(match[1]) as string
}

function assertGeneratedStringArrayConst(
  source: string,
  name: string,
  expected: readonly string[],
): void {
  const actual = parseGeneratedStringArrayConst(source, name)
  if (actual && stringArraysEqual(actual, expected)) return
  throw new Error(`generated runtime entry ${name} must match deployment graph`)
}

function parseGeneratedStringArrayConst(source: string, name: string): string[] | undefined {
  const escapedName = escapeRegExp(name)
  const match = source.match(
    new RegExp(`export\\s+const\\s+${escapedName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s+as\\s+const`),
  )
  if (!match) return undefined
  return Array.from(match[1].matchAll(/"((?:[^"\\]|\\.)*)"/g), (entry) =>
    JSON.parse(`"${entry[1]}"`),
  )
}

function stringArraysEqual(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  )
}

function formatIssues(issues: readonly string[]): string {
  return issues.map((issue) => `- ${issue}`).join("\n")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function requireString(value: unknown, label: string): string {
  if (typeof value === "string" && value.length > 0) return value
  throw new Error(`${label} must be a non-empty string`)
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value === "boolean") return value
  throw new Error(`${label} must be a boolean`)
}

function collectStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value.map((entry, index) => requireString(entry, `${label}[${index}]`))
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
