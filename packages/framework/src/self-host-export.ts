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
  "voyant.self-host-export-bundle.v2" as const
export const VOYANT_POSTGRES_EXPORT_SCHEMA_VERSION = "voyant.postgres-export.v1" as const
export const VOYANT_OBJECT_STORAGE_EXPORT_SCHEMA_VERSION =
  "voyant.object-storage-export.v1" as const
export const VOYANT_SELF_HOST_PROJECTION_SCHEMA_VERSION = "voyant.self-host-projection.v2" as const

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/
const EXACT_PACKAGE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const SHA512_INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]{86}==$/
const PORTABLE_PACKAGE_SOURCE_KINDS = new Set(["registry", "git"])

function validatedValue<T>(value: unknown): T {
  return value as T
}

export const VOYANT_SELF_HOST_MIGRATION_POLICY = {
  identity: ["source", "tag"],
  matchingEntry: "skip",
  contentHashMismatch: "reject-drift",
  pendingEntry: "apply",
} as const

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
  $id: "https://schemas.voyant.travel/self-host-export-bundle.v2.json",
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
  $id: "https://schemas.voyant.travel/self-host-projection.v2.json",
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
    "packageInstalls",
    "migrationJournal",
    "migrationPolicy",
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
    packageInstalls: { type: "array" },
    migrationJournal: { type: "object" },
    migrationPolicy: { type: "object" },
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
  | "VOYANT_EXPORT_INVALID_PACKAGE_PROVENANCE"
  | "VOYANT_EXPORT_SECRET_IN_PROJECT_CONFIG"
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

export type VoyantSelfHostPackageInstall =
  | {
      packageName: string
      coordinate: string
      source: {
        kind: "registry"
        reference: string
        integrity: string
      }
    }
  | {
      packageName: string
      coordinate: string
      source: {
        kind: "git"
        reference: string
        integrity?: string
      }
    }

export type VoyantSelfHostStarterProjection = Omit<
  typeof STANDARD_NODE_STARTER,
  "runtimeDependencyCoordinates"
> & {
  readonly runtimeDependencyCoordinates: Omit<
    (typeof STANDARD_NODE_STARTER)["runtimeDependencyCoordinates"],
    "@voyant-travel/framework"
  > & {
    readonly "@voyant-travel/framework": string
  }
}

export interface VoyantSelfHostProjection {
  schemaVersion: typeof VOYANT_SELF_HOST_PROJECTION_SCHEMA_VERSION
  ready: boolean
  frameworkVersion: string
  sourceGraphHash: string
  projectedGraphHash: string
  starter: VoyantSelfHostStarterProjection
  project: VoyantSelfHostProjectProjection
  graph: ResolvedVoyantDeploymentGraph
  providerRemaps: readonly VoyantSelfHostProviderRemap[]
  provisioning: {
    resources: ResolvedVoyantDeploymentGraph["requirements"]["resources"]
    database: VoyantPostgresExportMetadata
    objectStorage: VoyantObjectStorageExportManifest
  }
  packageInstalls: readonly VoyantSelfHostPackageInstall[]
  migrationJournal: typeof VOYANT_MIGRATION_JOURNAL_LINEAGE
  migrationPolicy: typeof VOYANT_SELF_HOST_MIGRATION_POLICY
  diagnostics: readonly VoyantSelfHostProjectionDiagnostic[]
}

export interface ProjectVoyantSelfHostExportOptions {
  providerOverrides?: Readonly<Record<string, string>>
}

export const VOYANT_SELF_HOST_PROVIDER_DEFAULTS = {
  adminAuth: { from: "voyant-cloud", to: "better-auth" },
  customerAuth: { from: "voyant-cloud", to: "better-auth" },
  // Compatibility for v1 export bundles.
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
    EXACT_PACKAGE_VERSION_PATTERN.test(input.frameworkVersion)
      ? input.frameworkVersion
      : undefined
  if (!frameworkVersion) {
    addIssue(
      issues,
      "VOYANT_EXPORT_INVALID_FRAMEWORK_VERSION",
      "$.frameworkVersion",
      "frameworkVersion must be an exact semantic version without a tag or range.",
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

  // agent-quality: unsafe-cast reviewed -- owner: framework; the complete runtime validator above establishes the export bundle shape.
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: validatedValue<VoyantSelfHostExportBundle>(input), issues: [] }
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
    starter: projectStarter(bundle.frameworkVersion),
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
    packageInstalls: projectPackageInstalls(graph),
    migrationJournal: VOYANT_MIGRATION_JOURNAL_LINEAGE,
    migrationPolicy: VOYANT_SELF_HOST_MIGRATION_POLICY,
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
  for (const kind of ["modules", "extensions", "plugins"] as const) {
    if (!Array.isArray(value[kind])) continue
    for (const [index, unit] of value[kind].entries()) {
      if (
        !isRecord(unit) ||
        !nonEmptyString(unit.id) ||
        !nonEmptyString(unit.packageName) ||
        (unit.projectConfig !== undefined && !isRecord(unit.projectConfig))
      ) {
        validShape = false
        addIssue(
          issues,
          "VOYANT_EXPORT_INVALID_GRAPH",
          `$.resolvedGraph.${kind}[${index}]`,
          `resolvedGraph.${kind} entries require non-empty id and packageName values plus an optional object projectConfig.`,
        )
        continue
      }
      if (unit.projectConfig !== undefined) {
        validateSecretFreeProjectConfig(
          unit.projectConfig,
          `$.resolvedGraph.${kind}[${index}].projectConfig`,
          issues,
        )
      }
    }
  }
  if (Array.isArray(value.packageRecords)) {
    for (const [index, record] of value.packageRecords.entries()) {
      if (!validPackageRecord(record)) {
        validShape = false
        addIssue(
          issues,
          "VOYANT_EXPORT_INVALID_GRAPH",
          `$.resolvedGraph.packageRecords[${index}]`,
          "resolvedGraph.packageRecords entries require a packageName, a supported source coordinate, and well-formed compatibility metadata.",
        )
        continue
      }
      // agent-quality: unsafe-cast reviewed -- owner: framework; validPackageRecord narrows every field consumed by provenance validation.
      validatePackageProvenance(
        validatedValue<ResolvedVoyantDeploymentGraph["packageRecords"][number]>(record),
        index,
        issues,
      )
    }
  }
  if (Array.isArray(value.diagnostics)) {
    for (const [index, diagnostic] of value.diagnostics.entries()) {
      if (!isRecord(diagnostic)) {
        validShape = false
        addIssue(
          issues,
          "VOYANT_EXPORT_INVALID_GRAPH",
          `$.resolvedGraph.diagnostics[${index}]`,
          "resolvedGraph.diagnostics entries must be objects.",
        )
      }
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
    if (isRecord(value.deployment.providers)) {
      for (const [role, provider] of Object.entries(value.deployment.providers)) {
        if (!nonEmptyString(provider)) {
          validShape = false
          addIssue(
            issues,
            "VOYANT_EXPORT_INVALID_GRAPH",
            `$.resolvedGraph.deployment.providers.${role}`,
            "Deployment provider selections must be non-empty strings.",
          )
        }
      }
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
  // agent-quality: unsafe-cast reviewed -- owner: framework; every graph collection and unit is validated before this projection.
  return validShape ? validatedValue<ResolvedVoyantDeploymentGraph>(value) : undefined
}

function validPackageRecord(value: unknown): boolean {
  if (!isRecord(value) || !nonEmptyString(value.packageName) || !isRecord(value.source)) {
    return false
  }
  if (
    !nonEmptyString(value.source.kind) ||
    (value.version !== undefined && !nonEmptyString(value.version)) ||
    (value.source.reference !== undefined && !nonEmptyString(value.source.reference)) ||
    (value.source.integrity !== undefined && !nonEmptyString(value.source.integrity))
  ) {
    return false
  }
  if (value.metadata === undefined) return true
  if (!isRecord(value.metadata)) return false
  if (value.metadata.compatibleWith === undefined) return true
  if (!isRecord(value.metadata.compatibleWith)) return false
  const compatibility = value.metadata.compatibleWith
  return (
    (compatibility.framework === undefined || nonEmptyString(compatibility.framework)) &&
    (compatibility.targets === undefined || stringArray(compatibility.targets)) &&
    (compatibility.modes === undefined || stringArray(compatibility.modes))
  )
}

function validatePackageProvenance(
  record: ResolvedVoyantDeploymentGraph["packageRecords"][number],
  index: number,
  issues: VoyantSelfHostExportValidationIssue[],
): void {
  if (record.source.kind !== "registry") return
  if (
    !record.version ||
    !EXACT_PACKAGE_VERSION_PATTERN.test(record.version) ||
    !registryReferenceMatches(record.source.reference, record.packageName, record.version) ||
    !record.source.integrity ||
    !SHA512_INTEGRITY_PATTERN.test(record.source.integrity)
  ) {
    addIssue(
      issues,
      "VOYANT_EXPORT_INVALID_PACKAGE_PROVENANCE",
      `$.resolvedGraph.packageRecords[${index}].source`,
      `Registry package ${record.packageName} must preserve an exact version, matching npm or pnpm-lock reference, and sha512 integrity.`,
    )
  }
}

function registryReferenceMatches(
  reference: string | undefined,
  packageName: string,
  version: string,
): boolean {
  if (!reference) return false
  if (reference === `npm:${packageName}@${version}`) return true
  const lockfilePrefix = `pnpm-lock:${packageName}@${version}`
  return reference === lockfilePrefix || reference.startsWith(`${lockfilePrefix}(`)
}

function validateSecretFreeProjectConfig(
  value: unknown,
  path: string,
  issues: VoyantSelfHostExportValidationIssue[],
): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      validateSecretFreeProjectConfig(item, `${path}[${index}]`, issues)
    }
    return
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      const itemPath = jsonPathProperty(path, key)
      if (secretLikeField(key)) {
        addSecretIssue(itemPath, "field name", issues)
        continue
      }
      validateSecretFreeProjectConfig(item, itemPath, issues)
    }
    return
  }
  if (typeof value === "string" && secretLikeValue(value)) {
    addSecretIssue(path, "value", issues)
  }
}

function secretLikeField(key: string): boolean {
  const tokens = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  if (
    tokens.some((token) =>
      ["password", "passwd", "secret", "token", "credential", "credentials"].includes(token),
    )
  ) {
    return true
  }
  const normalized = tokens.join("")
  return ["apikey", "privatekey", "accesskey", "signingkey", "authorization"].some((term) =>
    normalized.includes(term),
  )
}

function secretLikeValue(value: string): boolean {
  return (
    /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/.test(value) ||
    /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i.test(value) ||
    /^(?:Bearer\s+)?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) ||
    /^(?:sk_(?:live|test)_|gh[pousr]_|xox[baprs]-)[A-Za-z0-9_-]{8,}$/.test(value) ||
    /^AKIA[A-Z0-9]{16}$/.test(value)
  )
}

function addSecretIssue(
  path: string,
  reason: "field name" | "value",
  issues: VoyantSelfHostExportValidationIssue[],
): void {
  addIssue(
    issues,
    "VOYANT_EXPORT_SECRET_IN_PROJECT_CONFIG",
    path,
    `Projected package config contains a secret-like ${reason}; export only non-secret settings and provision secrets separately.`,
  )
}

function jsonPathProperty(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`
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
  // agent-quality: unsafe-cast reviewed -- owner: framework; all product BOM fields are narrowed immediately above.
  return validatedValue<VoyantProductBomReference>(value)
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

function projectPackageInstalls(
  graph: ResolvedVoyantDeploymentGraph,
): VoyantSelfHostPackageInstall[] {
  return [...graph.packageRecords]
    .sort((left, right) => left.packageName.localeCompare(right.packageName))
    .flatMap((record): VoyantSelfHostPackageInstall[] => {
      if (
        record.source.kind === "registry" &&
        record.version &&
        record.source.reference &&
        record.source.integrity
      ) {
        return [
          {
            packageName: record.packageName,
            coordinate: record.version,
            source: {
              kind: "registry",
              reference: record.source.reference,
              integrity: record.source.integrity,
            },
          },
        ]
      }
      if (record.source.kind === "git" && record.source.reference) {
        return [
          {
            packageName: record.packageName,
            coordinate: record.source.reference,
            source: {
              kind: "git",
              reference: record.source.reference,
              ...(record.source.integrity ? { integrity: record.source.integrity } : {}),
            },
          },
        ]
      }
      return []
    })
}

function projectStarter(frameworkVersion: string): VoyantSelfHostStarterProjection {
  return {
    ...STANDARD_NODE_STARTER,
    runtimeDependencyCoordinates: {
      ...STANDARD_NODE_STARTER.runtimeDependencyCoordinates,
      "@voyant-travel/framework": frameworkVersion,
    },
  }
}

function projectSelections(
  units: readonly ResolvedVoyantGraphUnit[],
  versions: ReadonlyMap<string, string | undefined>,
): VoyantSelfHostProjectSelection[] {
  return units.map((unit) => ({
    id: unit.id,
    resolve: specifierForResolvedUnit(unit),
    packageName: unit.packageName,
    ...(versions.get(unit.packageName) ? { version: versions.get(unit.packageName) } : {}),
    ...(unit.projectConfig ? { config: unit.projectConfig as VoyantGraphJsonObject } : {}),
  }))
}

function specifierForResolvedUnit(unit: ResolvedVoyantGraphUnit): string {
  if (unit.id === unit.packageName) return unit.packageName
  const localIdPrefix = `${unit.packageName}#`
  return unit.id.startsWith(localIdPrefix)
    ? `${unit.packageName}/${unit.id.slice(localIdPrefix.length)}`
    : unit.id
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

function stringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(nonEmptyString)
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
