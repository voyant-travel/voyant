// agent-quality: file-size exception -- reason: the v1 bundle schema, validator, and deterministic projection stay co-located so their duplicated hash/BOM authority cannot drift.
import type {
  DefineVoyantGraphProjectSelection,
  VoyantGraphJsonObject,
  VoyantGraphProjectDeploymentMigration,
  VoyantProductBomReference,
} from "@voyant-travel/core/project"
import { VOYANT_MIGRATION_JOURNAL_LINEAGE } from "@voyant-travel/framework-migrations"

export { VOYANT_MIGRATION_JOURNAL_LINEAGE } from "@voyant-travel/framework-migrations"

import {
  canonicalJson,
  deriveDeploymentRequirements,
  isVoyantVersionCompatible,
  type ResolvedVoyantDeploymentGraph,
  type ResolvedVoyantGraphUnit,
  sha256,
  VOYANT_RESOLVED_GRAPH_SCHEMA_VERSION,
} from "./deployment-graph.js"
import { DEPLOYMENT_PROVIDER_CONTRACTS, DEPLOYMENT_PROVIDER_ROLES } from "./deployment-types.js"
import { STANDARD_NODE_STARTER } from "./standard-node-starter.js"

export const VOYANT_SELF_HOST_EXPORT_BUNDLE_SCHEMA_VERSION =
  "voyant.self-host-export-bundle.v1" as const
export const VOYANT_POSTGRES_EXPORT_SCHEMA_VERSION = "voyant.postgres-export.v1" as const
export const VOYANT_OBJECT_STORAGE_EXPORT_SCHEMA_VERSION =
  "voyant.object-storage-export.v1" as const
export const VOYANT_SELF_HOST_PROJECTION_SCHEMA_VERSION = "voyant.self-host-projection.v1" as const

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/
const PORTABLE_PACKAGE_SOURCE_KINDS = new Set(["registry", "git"])

export type VoyantPostgresDumpFormat = "pg-custom" | "pg-directory" | "sql"

export interface VoyantExportArtifactMetadata {
  path: string
  byteLength: number
  contentHash: string
}

export interface VoyantPostgresExportMetadata {
  schemaVersion: typeof VOYANT_POSTGRES_EXPORT_SCHEMA_VERSION
  engine: "postgresql"
  format: VoyantPostgresDumpFormat
  dump: VoyantExportArtifactMetadata
  migrationJournal: typeof VOYANT_MIGRATION_JOURNAL_LINEAGE
}

export interface VoyantObjectStorageExportEntry extends VoyantExportArtifactMetadata {
  logicalStore: string
  key: string
  contentType?: string
}

export interface VoyantObjectStorageExportManifest {
  schemaVersion: typeof VOYANT_OBJECT_STORAGE_EXPORT_SCHEMA_VERSION
  objects: readonly VoyantObjectStorageExportEntry[]
}

/** Canonical, source-independent handoff from Voyant Cloud to self-host tooling. */
export interface VoyantSelfHostExportBundle {
  schemaVersion: typeof VOYANT_SELF_HOST_EXPORT_BUNDLE_SCHEMA_VERSION
  frameworkVersion: string
  graphHash: string
  productBom: VoyantProductBomReference
  resolvedGraph: ResolvedVoyantDeploymentGraph
  database: VoyantPostgresExportMetadata
  objectStorage: VoyantObjectStorageExportManifest
}

export const VOYANT_SELF_HOST_EXPORT_BUNDLE_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.voyant.travel/self-host-export-bundle.v1.json",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "frameworkVersion",
    "graphHash",
    "productBom",
    "resolvedGraph",
    "database",
    "objectStorage",
  ],
  properties: {
    schemaVersion: { const: VOYANT_SELF_HOST_EXPORT_BUNDLE_SCHEMA_VERSION },
    frameworkVersion: { type: "string", minLength: 1 },
    graphHash: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
    productBom: { type: "object" },
    resolvedGraph: {
      type: "object",
      required: ["schemaVersion", "contentHash", "deployment", "diagnostics"],
      properties: {
        schemaVersion: { const: VOYANT_RESOLVED_GRAPH_SCHEMA_VERSION },
        contentHash: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
      },
    },
    database: {
      type: "object",
      required: ["schemaVersion", "engine", "format", "dump", "migrationJournal"],
      properties: {
        schemaVersion: { const: VOYANT_POSTGRES_EXPORT_SCHEMA_VERSION },
        engine: { const: "postgresql" },
        format: { enum: ["pg-custom", "pg-directory", "sql"] },
      },
    },
    objectStorage: {
      type: "object",
      required: ["schemaVersion", "objects"],
      properties: {
        schemaVersion: { const: VOYANT_OBJECT_STORAGE_EXPORT_SCHEMA_VERSION },
        objects: { type: "array" },
      },
    },
  },
} as const

export const VOYANT_SELF_HOST_PROJECTION_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.voyant.travel/self-host-projection.v1.json",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "ready",
    "frameworkVersion",
    "sourceGraphHash",
    "projectedGraphHash",
    "starter",
    "project",
    "graph",
    "providerRemaps",
    "provisioning",
    "migrationJournal",
    "diagnostics",
  ],
  properties: {
    schemaVersion: { const: VOYANT_SELF_HOST_PROJECTION_SCHEMA_VERSION },
    ready: { type: "boolean" },
    frameworkVersion: { type: "string", minLength: 1 },
    sourceGraphHash: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
    projectedGraphHash: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
    starter: { type: "object" },
    project: { type: "object" },
    graph: { type: "object" },
    providerRemaps: { type: "array" },
    provisioning: { type: "object" },
    migrationJournal: { type: "object" },
    diagnostics: { type: "array" },
  },
} as const

export type VoyantSelfHostExportValidationIssueCode =
  | "VOYANT_EXPORT_INVALID_BUNDLE"
  | "VOYANT_EXPORT_INVALID_SCHEMA_VERSION"
  | "VOYANT_EXPORT_INVALID_FRAMEWORK_VERSION"
  | "VOYANT_EXPORT_INVALID_GRAPH"
  | "VOYANT_EXPORT_GRAPH_HASH_MISMATCH"
  | "VOYANT_EXPORT_GRAPH_NOT_CANONICAL"
  | "VOYANT_EXPORT_GRAPH_NOT_ADMITTED"
  | "VOYANT_EXPORT_BOM_MISMATCH"
  | "VOYANT_EXPORT_INVALID_DATABASE_DUMP"
  | "VOYANT_EXPORT_MIGRATION_LINEAGE_MISMATCH"
  | "VOYANT_EXPORT_INVALID_STORAGE_MANIFEST"

export interface VoyantSelfHostExportValidationIssue {
  code: VoyantSelfHostExportValidationIssueCode
  path: string
  message: string
}

export type VoyantSelfHostExportValidationResult =
  | { ok: true; value: VoyantSelfHostExportBundle; issues: readonly [] }
  | { ok: false; issues: readonly VoyantSelfHostExportValidationIssue[] }

export class VoyantSelfHostExportValidationError extends Error {
  constructor(readonly issues: readonly VoyantSelfHostExportValidationIssue[]) {
    super(
      `Invalid Voyant self-host export bundle:\n${issues.map(formatValidationIssue).join("\n")}`,
    )
    this.name = "VoyantSelfHostExportValidationError"
  }
}

export type VoyantSelfHostProjectionDiagnosticCode =
  | "VOYANT_SELF_HOST_PROVIDER_UNSUPPORTED"
  | "VOYANT_SELF_HOST_PACKAGE_INCOMPATIBLE"
  | "VOYANT_SELF_HOST_PACKAGE_SOURCE_UNAVAILABLE"

export interface VoyantSelfHostProjectionDiagnostic {
  code: VoyantSelfHostProjectionDiagnosticCode
  severity: "error"
  path: string
  message: string
  hint: string
}

export interface VoyantSelfHostProviderRemap {
  role: string
  from: string
  to: string
  reason: "self-host-default" | "explicit-override"
}

export interface VoyantSelfHostProjectSelection extends DefineVoyantGraphProjectSelection {
  id: string
  packageName: string
  version?: string
}

export interface VoyantSelfHostProjectProjection {
  productBom: VoyantProductBomReference
  modules: readonly VoyantSelfHostProjectSelection[]
  extensions: readonly VoyantSelfHostProjectSelection[]
  plugins: readonly VoyantSelfHostProjectSelection[]
  deployment: {
    target: "node"
    mode: "self-hosted"
    providers: Readonly<Record<string, string>>
    migrations?: readonly VoyantGraphProjectDeploymentMigration[]
  }
}

export interface VoyantSelfHostProjection {
  schemaVersion: typeof VOYANT_SELF_HOST_PROJECTION_SCHEMA_VERSION
  ready: boolean
  frameworkVersion: string
  sourceGraphHash: string
  projectedGraphHash: string
  starter: typeof STANDARD_NODE_STARTER
  project: VoyantSelfHostProjectProjection
  graph: ResolvedVoyantDeploymentGraph
  providerRemaps: readonly VoyantSelfHostProviderRemap[]
  provisioning: {
    resources: ResolvedVoyantDeploymentGraph["requirements"]["resources"]
    database: VoyantPostgresExportMetadata
    objectStorage: VoyantObjectStorageExportManifest
  }
  migrationJournal: typeof VOYANT_MIGRATION_JOURNAL_LINEAGE
  diagnostics: readonly VoyantSelfHostProjectionDiagnostic[]
}

export interface ProjectVoyantSelfHostExportOptions {
  providerOverrides?: Readonly<Record<string, string>>
}

export const VOYANT_SELF_HOST_PROVIDER_DEFAULTS = {
  auth: { from: "voyant-cloud", to: "better-auth" },
  email: { from: "voyant-cloud", to: "smtp" },
  realtime: { from: "voyant-cloud", to: "local" },
  scheduledJobs: { from: "cloud-scheduler", to: "node-cron" },
  workflows: { from: "voyant-cloud", to: "self-hosted" },
} as const

export async function validateVoyantSelfHostExportBundle(
  input: unknown,
): Promise<VoyantSelfHostExportValidationResult> {
  const issues: VoyantSelfHostExportValidationIssue[] = []
  if (!isRecord(input)) {
    return invalid("VOYANT_EXPORT_INVALID_BUNDLE", "$", "Export bundle must be an object.")
  }
  if (input.schemaVersion !== VOYANT_SELF_HOST_EXPORT_BUNDLE_SCHEMA_VERSION) {
    addIssue(
      issues,
      "VOYANT_EXPORT_INVALID_SCHEMA_VERSION",
      "$.schemaVersion",
      `schemaVersion must be ${VOYANT_SELF_HOST_EXPORT_BUNDLE_SCHEMA_VERSION}.`,
    )
  }
  const frameworkVersion =
    nonEmptyString(input.frameworkVersion) &&
    /^v?\d+\.\d+\.\d+(?:[-+].*)?$/.test(input.frameworkVersion)
      ? input.frameworkVersion
      : undefined
  if (!frameworkVersion) {
    addIssue(
      issues,
      "VOYANT_EXPORT_INVALID_FRAMEWORK_VERSION",
      "$.frameworkVersion",
      "frameworkVersion must be a semantic version.",
    )
  }

  const graph = validateGraph(input.resolvedGraph, issues)
  if (graph && frameworkVersion) {
    for (const [index, record] of graph.packageRecords.entries()) {
      const range = record.metadata?.compatibleWith?.framework
      if (range && !isVoyantVersionCompatible(frameworkVersion, range)) {
        addIssue(
          issues,
          "VOYANT_EXPORT_INVALID_FRAMEWORK_VERSION",
          `$.resolvedGraph.packageRecords[${index}].metadata.compatibleWith.framework`,
          `Package ${record.packageName} does not admit framework ${frameworkVersion}.`,
        )
      }
    }
  }
  const graphHash = sha256String(input.graphHash) ? input.graphHash : undefined
  if (!graphHash) {
    addIssue(
      issues,
      "VOYANT_EXPORT_GRAPH_HASH_MISMATCH",
      "$.graphHash",
      "graphHash must be a sha256-prefixed lowercase content hash.",
    )
  }
  if (graph && graphHash) {
    if (graphHash !== graph.contentHash) {
      addIssue(
        issues,
        "VOYANT_EXPORT_GRAPH_HASH_MISMATCH",
        "$.graphHash",
        `graphHash ${graphHash} does not match resolvedGraph.contentHash ${graph.contentHash}.`,
      )
    }
    const { contentHash: _contentHash, ...graphWithoutHash } = graph
    const canonicalHash = `sha256:${await sha256(graphWithoutHash)}`
    if (graph.contentHash !== canonicalHash) {
      addIssue(
        issues,
        "VOYANT_EXPORT_GRAPH_NOT_CANONICAL",
        "$.resolvedGraph.contentHash",
        `resolvedGraph.contentHash ${graph.contentHash} does not match canonical graph hash ${canonicalHash}.`,
      )
    }
  }

  const productBom = validateProductBom(input.productBom, issues)
  if (
    graph &&
    productBom &&
    canonicalJson(productBom) !== canonicalJson(graph.project.productBom)
  ) {
    addIssue(
      issues,
      "VOYANT_EXPORT_BOM_MISMATCH",
      "$.productBom",
      "productBom must exactly match resolvedGraph.project.productBom.",
    )
  }
  validateDatabase(input.database, issues)
  validateObjectStorage(input.objectStorage, issues)

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as VoyantSelfHostExportBundle, issues: [] }
}

export async function projectVoyantSelfHostExport(
  input: unknown,
  options: ProjectVoyantSelfHostExportOptions = {},
): Promise<VoyantSelfHostProjection> {
  const validation = await validateVoyantSelfHostExportBundle(input)
  if (!validation.ok) throw new VoyantSelfHostExportValidationError(validation.issues)
  const bundle = validation.value
  const diagnostics: VoyantSelfHostProjectionDiagnostic[] = []
  const { providers, remaps } = remapProviders(
    bundle.resolvedGraph.deployment.providers,
    options.providerOverrides ?? {},
    diagnostics,
  )
  validatePackagePortability(bundle.resolvedGraph, diagnostics)

  const requirements = deriveDeploymentRequirements(providers)
  const { contentHash: _contentHash, ...graphWithoutHash } = bundle.resolvedGraph
  const projectedWithoutHash: Omit<ResolvedVoyantDeploymentGraph, "contentHash"> = {
    ...graphWithoutHash,
    deployment: {
      ...graphWithoutHash.deployment,
      target: "node",
      mode: "self-hosted",
      providers,
    },
    requirements,
  }
  const graph: ResolvedVoyantDeploymentGraph = {
    ...projectedWithoutHash,
    contentHash: `sha256:${await sha256(projectedWithoutHash)}`,
  }
  const versions = new Map(
    graph.packageRecords.map((record) => [record.packageName, record.version] as const),
  )

  return {
    schemaVersion: VOYANT_SELF_HOST_PROJECTION_SCHEMA_VERSION,
    ready: diagnostics.length === 0,
    frameworkVersion: bundle.frameworkVersion,
    sourceGraphHash: bundle.graphHash,
    projectedGraphHash: graph.contentHash,
    starter: STANDARD_NODE_STARTER,
    project: {
      productBom: bundle.productBom,
      modules: projectSelections(graph.modules, versions),
      extensions: projectSelections(graph.extensions, versions),
      plugins: projectSelections(graph.plugins, versions),
      deployment: {
        target: "node",
        mode: "self-hosted",
        providers,
        ...(graph.deployment.migrations?.length ? { migrations: graph.deployment.migrations } : {}),
      },
    },
    graph,
    providerRemaps: remaps,
    provisioning: {
      resources: requirements.resources,
      database: bundle.database,
      objectStorage: bundle.objectStorage,
    },
    migrationJournal: VOYANT_MIGRATION_JOURNAL_LINEAGE,
    diagnostics,
  }
}

function validateGraph(
  value: unknown,
  issues: VoyantSelfHostExportValidationIssue[],
): ResolvedVoyantDeploymentGraph | undefined {
  if (!isRecord(value)) {
    addIssue(
      issues,
      "VOYANT_EXPORT_INVALID_GRAPH",
      "$.resolvedGraph",
      "resolvedGraph must be an object.",
    )
    return undefined
  }
  if (value.schemaVersion !== VOYANT_RESOLVED_GRAPH_SCHEMA_VERSION) {
    addIssue(
      issues,
      "VOYANT_EXPORT_INVALID_GRAPH",
      "$.resolvedGraph.schemaVersion",
      `resolvedGraph.schemaVersion must be ${VOYANT_RESOLVED_GRAPH_SCHEMA_VERSION}.`,
    )
  }
  if (!sha256String(value.contentHash)) {
    addIssue(
      issues,
      "VOYANT_EXPORT_INVALID_GRAPH",
      "$.resolvedGraph.contentHash",
      "resolvedGraph.contentHash must be a sha256-prefixed lowercase content hash.",
    )
  }
  let validShape = true
  for (const key of [
    "modules",
    "extensions",
    "plugins",
    "packageRecords",
    "diagnostics",
  ] as const) {
    if (!Array.isArray(value[key])) {
      validShape = false
      addIssue(
        issues,
        "VOYANT_EXPORT_INVALID_GRAPH",
        `$.resolvedGraph.${key}`,
        `resolvedGraph.${key} must be an array.`,
      )
    }
  }
  if (
    !isRecord(value.project) ||
    !isRecord(value.deployment) ||
    !isRecord(value.deployment.providers) ||
    !isRecord(value.requirements) ||
    !isRecord(value.capabilities) ||
    !isRecord(value.accessCatalog) ||
    !isRecord(value.webhookPlan) ||
    !isRecord(value.provisioning)
  ) {
    validShape = false
    addIssue(
      issues,
      "VOYANT_EXPORT_INVALID_GRAPH",
      "$.resolvedGraph",
      "resolvedGraph is missing required project, deployment, provider, requirement, capability, access, webhook, or provisioning objects.",
    )
  }
  if (isRecord(value.deployment)) {
    if (value.deployment.target !== "node" || value.deployment.mode !== "managed-cloud") {
      addIssue(
        issues,
        "VOYANT_EXPORT_INVALID_GRAPH",
        "$.resolvedGraph.deployment",
        'Export source graph must use target "node" and mode "managed-cloud".',
      )
    }
  }
  if (Array.isArray(value.diagnostics)) {
    for (const [index, diagnostic] of value.diagnostics.entries()) {
      if (isRecord(diagnostic) && diagnostic.severity === "error") {
        addIssue(
          issues,
          "VOYANT_EXPORT_GRAPH_NOT_ADMITTED",
          `$.resolvedGraph.diagnostics[${index}]`,
          `Resolved graph contains error diagnostic ${String(diagnostic.code ?? "unknown")}.`,
        )
      }
    }
  }
  if (
    Array.isArray(value.modules) &&
    Array.isArray(value.extensions) &&
    Array.isArray(value.plugins) &&
    Array.isArray(value.packageRecords)
  ) {
    const packageNames = new Set(
      value.packageRecords
        .filter(isRecord)
        .map((record) => record.packageName)
        .filter(nonEmptyString),
    )
    for (const [kind, units] of [
      ["modules", value.modules],
      ["extensions", value.extensions],
      ["plugins", value.plugins],
    ] as const) {
      for (const [index, unit] of units.entries()) {
        if (
          isRecord(unit) &&
          nonEmptyString(unit.packageName) &&
          !packageNames.has(unit.packageName)
        ) {
          addIssue(
            issues,
            "VOYANT_EXPORT_GRAPH_NOT_ADMITTED",
            `$.resolvedGraph.${kind}[${index}].packageName`,
            `Selected package ${unit.packageName} is missing from admitted packageRecords.`,
          )
        }
      }
    }
  }
  return validShape ? (value as ResolvedVoyantDeploymentGraph) : undefined
}

function validateProductBom(
  value: unknown,
  issues: VoyantSelfHostExportValidationIssue[],
): VoyantProductBomReference | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== "voyant.product-bom-reference.v1" ||
    !nonEmptyString(value.id) ||
    !nonEmptyString(value.version)
  ) {
    addIssue(
      issues,
      "VOYANT_EXPORT_BOM_MISMATCH",
      "$.productBom",
      "productBom must be a complete voyant.product-bom-reference.v1 object.",
    )
    return undefined
  }
  return value as VoyantProductBomReference
}

function validateDatabase(value: unknown, issues: VoyantSelfHostExportValidationIssue[]): void {
  if (
    !isRecord(value) ||
    value.schemaVersion !== VOYANT_POSTGRES_EXPORT_SCHEMA_VERSION ||
    value.engine !== "postgresql" ||
    (value.format !== "pg-custom" && value.format !== "pg-directory" && value.format !== "sql")
  ) {
    addIssue(
      issues,
      "VOYANT_EXPORT_INVALID_DATABASE_DUMP",
      "$.database",
      `database must be a ${VOYANT_POSTGRES_EXPORT_SCHEMA_VERSION} PostgreSQL dump descriptor.`,
    )
    return
  }
  validateArtifact(value.dump, "$.database.dump", "VOYANT_EXPORT_INVALID_DATABASE_DUMP", issues)
  if (canonicalJson(value.migrationJournal) !== canonicalJson(VOYANT_MIGRATION_JOURNAL_LINEAGE)) {
    addIssue(
      issues,
      "VOYANT_EXPORT_MIGRATION_LINEAGE_MISMATCH",
      "$.database.migrationJournal",
      `migrationJournal must use ${VOYANT_MIGRATION_JOURNAL_LINEAGE.schemaVersion} at ${VOYANT_MIGRATION_JOURNAL_LINEAGE.ledgerSchema}.${VOYANT_MIGRATION_JOURNAL_LINEAGE.ledgerTable}.`,
    )
  }
}

function validateObjectStorage(
  value: unknown,
  issues: VoyantSelfHostExportValidationIssue[],
): void {
  if (
    !isRecord(value) ||
    value.schemaVersion !== VOYANT_OBJECT_STORAGE_EXPORT_SCHEMA_VERSION ||
    !Array.isArray(value.objects)
  ) {
    addIssue(
      issues,
      "VOYANT_EXPORT_INVALID_STORAGE_MANIFEST",
      "$.objectStorage",
      `objectStorage must be a ${VOYANT_OBJECT_STORAGE_EXPORT_SCHEMA_VERSION} manifest.`,
    )
    return
  }
  const keys = new Set<string>()
  for (const [index, entry] of value.objects.entries()) {
    const path = `$.objectStorage.objects[${index}]`
    validateArtifact(entry, path, "VOYANT_EXPORT_INVALID_STORAGE_MANIFEST", issues)
    if (!isRecord(entry) || !nonEmptyString(entry.logicalStore) || !nonEmptyString(entry.key)) {
      addIssue(
        issues,
        "VOYANT_EXPORT_INVALID_STORAGE_MANIFEST",
        path,
        "Storage entries require non-empty logicalStore and key values.",
      )
      continue
    }
    const identity = `${entry.logicalStore}:${entry.key}`
    if (keys.has(identity)) {
      addIssue(
        issues,
        "VOYANT_EXPORT_INVALID_STORAGE_MANIFEST",
        path,
        `Duplicate object storage entry ${identity}.`,
      )
    }
    keys.add(identity)
  }
}

function validateArtifact(
  value: unknown,
  path: string,
  code: "VOYANT_EXPORT_INVALID_DATABASE_DUMP" | "VOYANT_EXPORT_INVALID_STORAGE_MANIFEST",
  issues: VoyantSelfHostExportValidationIssue[],
): void {
  if (
    !isRecord(value) ||
    !portablePath(value.path) ||
    !Number.isSafeInteger(value.byteLength) ||
    Number(value.byteLength) < 0 ||
    !sha256String(value.contentHash)
  ) {
    addIssue(
      issues,
      code,
      path,
      "Artifact metadata requires a relative path, non-negative byteLength, and sha256 contentHash.",
    )
  }
}

function remapProviders(
  source: Readonly<Record<string, string | undefined>>,
  overrides: Readonly<Record<string, string>>,
  diagnostics: VoyantSelfHostProjectionDiagnostic[],
): { providers: Record<string, string>; remaps: VoyantSelfHostProviderRemap[] } {
  const providers: Record<string, string> = {}
  const remaps: VoyantSelfHostProviderRemap[] = []
  for (const role of [
    ...new Set([...DEPLOYMENT_PROVIDER_ROLES, ...Object.keys(source), ...Object.keys(overrides)]),
  ].sort()) {
    const original = source[role]
    const override = overrides[role]
    if (!nonEmptyString(original) && !nonEmptyString(override)) {
      diagnostics.push({
        code: "VOYANT_SELF_HOST_PROVIDER_UNSUPPORTED",
        severity: "error",
        path: `$.resolvedGraph.deployment.providers.${role}`,
        message: `Provider role ${role} has no explicit selection.`,
        hint: providerHint(role),
      })
      continue
    }
    let selected = override ?? original!
    let reason: VoyantSelfHostProviderRemap["reason"] | undefined
    if (override !== undefined && override !== original) {
      reason = "explicit-override"
    } else {
      const mapping =
        VOYANT_SELF_HOST_PROVIDER_DEFAULTS[role as keyof typeof VOYANT_SELF_HOST_PROVIDER_DEFAULTS]
      if (mapping && selected === mapping.from) {
        selected = mapping.to
        reason = "self-host-default"
      }
    }
    providers[role] = selected
    if (reason && original) remaps.push({ role, from: original, to: selected, reason })
    if (!selfHostProviderSupported(role, selected)) {
      diagnostics.push({
        code: "VOYANT_SELF_HOST_PROVIDER_UNSUPPORTED",
        severity: "error",
        path: `$.resolvedGraph.deployment.providers.${role}`,
        message: `Provider ${role}=${JSON.stringify(selected)} has no supported self-host projection.`,
        hint: providerHint(role),
      })
    }
  }
  return { providers, remaps }
}

function selfHostProviderSupported(role: string, provider: string): boolean {
  const contracts = DEPLOYMENT_PROVIDER_CONTRACTS[
    role as keyof typeof DEPLOYMENT_PROVIDER_CONTRACTS
  ] as readonly string[] | undefined
  if (!contracts) return provider !== "voyant-cloud" && provider !== "platform"
  if (!contracts.includes(provider)) return false
  return !(provider === "voyant-cloud" || provider === "platform" || provider === "cloud-scheduler")
}

function providerHint(role: string): string {
  const contracts = DEPLOYMENT_PROVIDER_CONTRACTS[
    role as keyof typeof DEPLOYMENT_PROVIDER_CONTRACTS
  ] as readonly string[] | undefined
  const supported = (contracts ?? []).filter((provider) =>
    selfHostProviderSupported(role, provider),
  )
  return supported.length > 0
    ? `Set providerOverrides.${role} to one of: ${supported.join(", ")}.`
    : `Install a self-host-capable provider package and set providerOverrides.${role}.`
}

function validatePackagePortability(
  graph: ResolvedVoyantDeploymentGraph,
  diagnostics: VoyantSelfHostProjectionDiagnostic[],
): void {
  const selectedPackages = new Set(
    [...graph.modules, ...graph.extensions, ...graph.plugins].map((unit) => unit.packageName),
  )
  for (const record of graph.packageRecords) {
    if (!selectedPackages.has(record.packageName)) continue
    const modes = record.metadata?.compatibleWith?.modes
    if (modes && !modes.includes("self-hosted")) {
      diagnostics.push({
        code: "VOYANT_SELF_HOST_PACKAGE_INCOMPATIBLE",
        severity: "error",
        path: `$.resolvedGraph.packageRecords[${JSON.stringify(record.packageName)}]`,
        message: `Package ${record.packageName} does not declare self-hosted compatibility.`,
        hint: "Upgrade or replace the package with one that admits self-hosted mode.",
      })
    }
    if (!PORTABLE_PACKAGE_SOURCE_KINDS.has(record.source.kind)) {
      diagnostics.push({
        code: "VOYANT_SELF_HOST_PACKAGE_SOURCE_UNAVAILABLE",
        severity: "error",
        path: `$.resolvedGraph.packageRecords[${JSON.stringify(record.packageName)}].source`,
        message: `Package ${record.packageName} uses non-portable source kind ${record.source.kind}.`,
        hint: "Publish the package to a registry or provide an installable git source before export.",
      })
      continue
    }
    if (
      (record.source.kind === "registry" && !nonEmptyString(record.version)) ||
      (record.source.kind === "git" && !nonEmptyString(record.source.reference))
    ) {
      diagnostics.push({
        code: "VOYANT_SELF_HOST_PACKAGE_SOURCE_UNAVAILABLE",
        severity: "error",
        path: `$.resolvedGraph.packageRecords[${JSON.stringify(record.packageName)}].source`,
        message: `Package ${record.packageName} does not include an exact installable ${record.source.kind} coordinate.`,
        hint:
          record.source.kind === "registry"
            ? "Export the admitted registry package version."
            : "Export the admitted git reference.",
      })
    }
  }
}

function projectSelections(
  units: readonly ResolvedVoyantGraphUnit[],
  versions: ReadonlyMap<string, string | undefined>,
): VoyantSelfHostProjectSelection[] {
  return units.map((unit) => ({
    id: unit.id,
    resolve: unit.id,
    packageName: unit.packageName,
    ...(versions.get(unit.packageName) ? { version: versions.get(unit.packageName) } : {}),
    ...(unit.projectConfig ? { config: unit.projectConfig as VoyantGraphJsonObject } : {}),
  }))
}

function portablePath(value: unknown): value is string {
  return (
    nonEmptyString(value) &&
    !value.startsWith("/") &&
    !value.startsWith("\\") &&
    !/^[a-zA-Z]:/.test(value) &&
    !value.split(/[\\/]/).includes("..")
  )
}

function sha256String(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function addIssue(
  issues: VoyantSelfHostExportValidationIssue[],
  code: VoyantSelfHostExportValidationIssueCode,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message })
}

function invalid(
  code: VoyantSelfHostExportValidationIssueCode,
  path: string,
  message: string,
): VoyantSelfHostExportValidationResult {
  return { ok: false, issues: [{ code, path, message }] }
}

function formatValidationIssue(issue: VoyantSelfHostExportValidationIssue): string {
  return `- ${issue.code} at ${issue.path}: ${issue.message}`
}
