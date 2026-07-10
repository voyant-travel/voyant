import { readFile } from "node:fs/promises"

import {
  buildDeploymentArtifactManifest,
  buildDeploymentGraphJson,
  buildManagedNodeRuntimeEntry,
  buildManagedNodeRuntimeEntryArtifact,
  VOYANT_DEPLOYMENT_ARTIFACTS_SCHEMA_VERSION,
} from "../packages/framework/src/deployment-artifacts.ts"
import {
  canonicalJson,
  resolveManagedProfileDeploymentGraph,
  VOYANT_GRAPH_DIAGNOSTIC_CODE_REGISTRY,
} from "../packages/framework/src/deployment-graph.ts"
import { defineVoyantProject } from "../packages/framework/src/profile.ts"
import {
  OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MODULE_IDS,
  OPERATOR_LOCAL_DEPLOYMENT_GRAPH_PLUGIN_IDS,
  OPERATOR_RUNTIME_DEPLOYMENT_GRAPH_PLUGIN_IDS,
  OPERATOR_SCHEMA_ONLY_DEPLOYMENT_GRAPH_MODULE_IDS,
} from "../starters/operator/deployment-graph.local.ts"
import { schema as operatorSchemaPaths } from "../starters/operator/drizzle.schemas.generated.ts"
import { OPERATOR_VOYANT_DEPLOYMENT } from "../starters/operator/voyant.deployment.ts"
import { OPERATOR_VOYANT_PROJECT } from "../starters/operator/voyant.project.ts"
import { readPnpmLockfilePackageRecords } from "./lib/deployment-graph-provenance.mjs"
import {
  OPERATOR_GRAPH_ADMISSION_POLICY,
  OPERATOR_GRAPH_PACKAGE_METADATA_OVERRIDES,
  withOperatorDeploymentLocalPackageRecords,
} from "./lib/operator-deployment-graph-package-records.ts"

const failures: string[] = []

const project = defineVoyantProject({
  profile: "operator",
  frameworkVersion: "0.26.0",
  modules: ["bookings", "finance", "relationships"],
  plugins: ["@voyant-travel/plugin-netopia"],
})

const OPERATOR_PACKAGE_METADATA_KIND_EXPECTATIONS = new Map<string, string>([
  ["@voyant-travel/framework", "framework"],
  ["@voyant-travel/framework-migrations", "library"],
  ["@voyant-travel/hono", "library"],
  ["@voyant-travel/plugin-netopia", "plugin"],
])

async function main(): Promise<void> {
  const discoveredGraph = await resolveManagedProfileDeploymentGraph(project)
  const packageRecords = withOperatorDeploymentLocalPackageRecords(
    readPnpmLockfilePackageRecords({
      packageNames: discoveredGraph.packageRecords.map((record) => record.packageName),
      packageMetadata: OPERATOR_GRAPH_PACKAGE_METADATA_OVERRIDES,
    }),
  )
  const first = await resolveManagedProfileDeploymentGraph(project, {
    packageRecords,
    admission: OPERATOR_GRAPH_ADMISSION_POLICY,
  })
  const second = await resolveManagedProfileDeploymentGraph(project, {
    packageRecords,
    admission: OPERATOR_GRAPH_ADMISSION_POLICY,
  })

  if (first.schemaVersion !== "voyant.resolved-graph.v1") {
    failures.push(`expected resolved graph schema v1, got ${first.schemaVersion}`)
  }

  if (!/^sha256:[a-f0-9]{64}$/.test(first.contentHash)) {
    failures.push(`expected sha256 content hash, got ${first.contentHash}`)
  }

  if (first.contentHash !== second.contentHash) {
    failures.push("expected managed profile graph hash to be deterministic across identical inputs")
  }

  if (canonicalJson(first) !== canonicalJson(second)) {
    failures.push("expected managed profile graph JSON manifest to be deterministic")
  }

  const graphJson = buildDeploymentGraphJson(first)
  const parsedGraphJson = JSON.parse(graphJson) as { contentHash?: string; schemaVersion?: string }
  if (parsedGraphJson.contentHash !== first.contentHash) {
    failures.push("expected generated graph JSON artifact to include the resolved graph hash")
  }
  if (parsedGraphJson.schemaVersion !== first.schemaVersion) {
    failures.push("expected generated graph JSON artifact to preserve the graph schema version")
  }

  const runtimeEntry = buildManagedNodeRuntimeEntry({
    graph: first,
    graphArtifactPath: "../deployment-graph.generated.json",
    profileSnapshotPath: "../managed-profile.json",
  })
  if (!runtimeEntry.includes(first.contentHash)) {
    failures.push("expected generated runtime entry to reference the resolved graph hash")
  }
  if (!runtimeEntry.includes("@voyant-travel/framework/managed-runtime")) {
    failures.push("expected generated runtime entry to start from the framework managed runtime")
  }

  const artifactManifest = buildDeploymentArtifactManifest({
    graph: first,
    graphArtifactPath: "deployment-graph.generated.json",
    runtimeEntries: [
      buildManagedNodeRuntimeEntryArtifact({
        graph: first,
        file: "src/runtime-entry.generated.ts",
        profileSnapshot: "managed-profile.json",
      }),
    ],
    migrationSources: operatorMigrationSources(),
  })
  if (artifactManifest.schemaVersion !== VOYANT_DEPLOYMENT_ARTIFACTS_SCHEMA_VERSION) {
    failures.push("expected deployment artifact manifest schema version v1")
  }
  if (artifactManifest.graphHash !== first.contentHash) {
    failures.push("expected deployment artifact manifest to reference the resolved graph hash")
  }
  if (artifactManifest.runtimeEntries[0]?.graphHash !== first.contentHash) {
    failures.push("expected runtime entry artifact to reference the resolved graph hash")
  }
  const artifactMigrationSourcePackageNames = artifactManifest.migrationSources.map(
    (source) => source.packageName,
  )
  if (
    JSON.stringify(artifactMigrationSourcePackageNames) !==
    JSON.stringify(operatorMigrationSourcePackageNames())
  ) {
    failures.push("expected deployment artifacts to preserve operator migration source packages")
  }

  if (first.diagnostics.length > 0) {
    failures.push(
      `expected managed profile graph to resolve cleanly, got diagnostics:\n${first.diagnostics
        .map((entry) => `  - ${entry.code}: ${entry.message}`)
        .join("\n")}`,
    )
  }

  const moduleIds = new Set(first.modules.map((unit) => unit.id))
  for (const id of [
    "@voyant-travel/action-ledger",
    "@voyant-travel/bookings",
    "@voyant-travel/finance",
    "@voyant-travel/relationships",
  ]) {
    if (!moduleIds.has(id)) failures.push(`expected managed graph to include ${id}`)
  }

  if (moduleIds.has("@voyant-travel/flights")) {
    failures.push("expected managed graph to honor the selected module subset and exclude flights")
  }

  if (!first.plugins.some((unit) => unit.id === "@voyant-travel/plugin-netopia")) {
    failures.push("expected managed graph to include selected plugin @voyant-travel/plugin-netopia")
  }

  const operatorGraph = await readOperatorGeneratedGraph()
  const operatorModuleIds = new Set(operatorGraph.modules.map((unit) => unit.id))
  const operatorPluginIds = new Set(operatorGraph.plugins.map((unit) => unit.id))
  const declaredOperatorModuleIds = new Set(OPERATOR_VOYANT_PROJECT.modules.map((unit) => unit.id))
  const declaredOperatorPluginIds = new Set(OPERATOR_VOYANT_PROJECT.plugins.map((unit) => unit.id))
  if (OPERATOR_VOYANT_DEPLOYMENT.project !== OPERATOR_VOYANT_PROJECT) {
    failures.push(
      "expected operator deployment declaration to bind the operator project declaration",
    )
  }
  if (operatorGraph.project?.presetLineage !== OPERATOR_VOYANT_PROJECT.presetLineage) {
    failures.push("expected generated operator graph to preserve declared preset lineage")
  }
  for (const id of declaredOperatorModuleIds) {
    if (!operatorModuleIds.has(id)) {
      failures.push(`expected generated operator graph to include declared module ${id}`)
    }
  }
  for (const id of declaredOperatorPluginIds) {
    if (!operatorPluginIds.has(id)) {
      failures.push(`expected generated operator graph to include declared plugin ${id}`)
    }
  }
  for (const id of operatorModuleIds) {
    if (!declaredOperatorModuleIds.has(id)) {
      failures.push(`expected generated operator graph module ${id} to come from the declaration`)
    }
  }
  for (const id of operatorPluginIds) {
    if (!declaredOperatorPluginIds.has(id)) {
      failures.push(`expected generated operator graph plugin ${id} to come from the declaration`)
    }
  }
  const operatorPackageRecords = new Map(
    operatorGraph.packageRecords.map((record) => [record.packageName, record]),
  )
  const operatorPackageNames = new Set(
    operatorGraph.packageRecords.map((record) => record.packageName),
  )
  for (const record of operatorGraph.packageRecords) {
    if (record.source?.kind === "unknown") {
      failures.push(`expected operator graph package record ${record.packageName} to be admitted`)
    }
    const expectedKind =
      OPERATOR_PACKAGE_METADATA_KIND_EXPECTATIONS.get(record.packageName) ?? "module"
    const metadata = record.metadata
    if (
      metadata?.schemaVersion !== "voyant.package.v1" ||
      metadata.kind !== expectedKind ||
      typeof metadata.compatibleWith?.framework !== "string" ||
      !metadata.compatibleWith.targets?.includes("node") ||
      !metadata.compatibleWith.targets?.includes("voyant-cloud") ||
      !metadata.compatibleWith.modes?.includes("local") ||
      !metadata.compatibleWith.modes?.includes("managed-cloud") ||
      !metadata.compatibleWith.modes?.includes("self-hosted")
    ) {
      failures.push(
        `expected operator graph package record ${record.packageName} to include voyant.package.v1 ${expectedKind} compatibility metadata`,
      )
    }
  }
  if (!operatorPackageNames.has("@voyant-travel/hono")) {
    failures.push("expected operator graph package records to include @voyant-travel/hono")
  }
  if (operatorPackageNames.has("@voyant-travel/public-document-delivery")) {
    failures.push(
      "expected public document delivery graph unit provenance to resolve to @voyant-travel/hono",
    )
  }
  if (!operatorPackageNames.has("@voyant-travel/plugin-netopia")) {
    failures.push(
      "expected operator graph package records to include @voyant-travel/plugin-netopia",
    )
  }
  for (const id of OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MODULE_IDS) {
    if (!operatorModuleIds.has(id)) failures.push(`expected operator graph to include ${id}`)
  }
  const operatorWorkflowModule = operatorGraph.modules.find(
    (unit) => unit.id === "@voyant-travel/operator#workflows",
  )
  const operatorWorkflowIds = new Set(operatorWorkflowModule?.workflows?.map((entry) => entry.id))
  for (const workflowId of ["bookings.expire-stale-holds", "notifications.send-due-reminders"]) {
    if (!operatorWorkflowIds.has(workflowId)) {
      failures.push(`expected operator workflow graph module to include ${workflowId}`)
    }
    if (
      !operatorGraph.provisioning?.scheduledJobs?.some(
        (job) => job.workflowId === workflowId && job.id.includes(`#workflows.schedule.`),
      )
    ) {
      failures.push(`expected operator graph provisioning to schedule ${workflowId}`)
    }
  }
  for (const id of OPERATOR_SCHEMA_ONLY_DEPLOYMENT_GRAPH_MODULE_IDS) {
    if (!operatorModuleIds.has(id)) {
      failures.push(`expected operator graph to include schema-only module ${id}`)
    }
  }
  for (const id of [
    ...OPERATOR_LOCAL_DEPLOYMENT_GRAPH_PLUGIN_IDS,
    ...OPERATOR_RUNTIME_DEPLOYMENT_GRAPH_PLUGIN_IDS,
  ]) {
    if (!operatorPluginIds.has(id)) failures.push(`expected operator graph to include ${id}`)
  }
  for (const packageName of operatorMigrationSourcePackageNames()) {
    if (!operatorPackageRecords.has(packageName)) {
      failures.push(
        `expected operator graph package records to include migration source ${packageName}`,
      )
    }
  }

  const operatorMigrateSource = await readFile(
    new URL("../starters/operator/scripts/migrate.ts", import.meta.url),
    "utf8",
  )
  if (operatorMigrateSource.includes("drizzle.schemas.generated")) {
    failures.push("expected operator db:migrate to avoid importing drizzle.schemas.generated.ts")
  }
  if (!operatorMigrateSource.includes("deploymentGraphArtifacts.migrationSources")) {
    failures.push("expected operator db:migrate to consume graph artifact migration sources")
  }

  const frameworkRecord = first.packageRecords.find(
    (record) => record.packageName === "@voyant-travel/framework",
  )
  if (frameworkRecord?.source.kind !== "workspace" || !frameworkRecord.version) {
    failures.push(
      "expected @voyant-travel/framework package record to include workspace provenance",
    )
  }

  const netopiaRecord = first.packageRecords.find(
    (record) => record.packageName === "@voyant-travel/plugin-netopia",
  )
  if (
    netopiaRecord?.source.kind !== "registry" ||
    !netopiaRecord.version ||
    !netopiaRecord.source.integrity
  ) {
    failures.push(
      "expected @voyant-travel/plugin-netopia package record to include lockfile registry provenance",
    )
  }

  const diagnosticCodes = Object.keys(VOYANT_GRAPH_DIAGNOSTIC_CODE_REGISTRY)
  const sortedCodes = [...diagnosticCodes].sort()
  if (JSON.stringify(diagnosticCodes) !== JSON.stringify(sortedCodes)) {
    failures.push("expected deployment graph diagnostic code registry to stay sorted")
  }

  if (failures.length > 0) {
    console.error("Deployment graph architecture check failed.")
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
  }

  console.log(
    `check-deployment-graph: OK (${first.modules.length} modules, ${first.plugins.length} plugins, ${first.contentHash})`,
  )
}

async function readOperatorGeneratedGraph(): Promise<{
  project?: { presetLineage?: string }
  modules: Array<{
    id: string
    workflows?: Array<{ id: string }>
  }>
  plugins: Array<{ id: string }>
  packageRecords: Array<{
    packageName: string
    source?: { kind?: string }
    metadata?: {
      schemaVersion?: string
      kind?: string
      compatibleWith?: {
        framework?: string
        targets?: string[]
        modes?: string[]
      }
    }
  }>
  provisioning?: {
    scheduledJobs?: Array<{ id: string; workflowId?: string }>
  }
}> {
  return JSON.parse(
    await readFile(
      new URL("../starters/operator/deployment-graph.generated.json", import.meta.url),
      "utf8",
    ),
  ) as {
    modules: Array<{
      id: string
      workflows?: Array<{ id: string }>
    }>
    plugins: Array<{ id: string }>
    packageRecords: Array<{
      packageName: string
      source?: { kind?: string }
      metadata?: {
        schemaVersion?: string
        kind?: string
        compatibleWith?: {
          framework?: string
          targets?: string[]
          modes?: string[]
        }
      }
    }>
    provisioning?: {
      scheduledJobs?: Array<{ id: string; workflowId?: string }>
    }
  }
}

function operatorMigrationSourcePackageNames(): string[] {
  return operatorMigrationSources().map((source) => source.packageName)
}

function operatorMigrationSources(): Array<{ packageName: string; schema: string }> {
  const seen = new Set<string>()
  const sources: Array<{ packageName: string; schema: string }> = []
  for (const schemaPath of operatorSchemaPaths) {
    const match = schemaPath.match(/(?:^|\/)packages\/([^/]+)\//)
    if (!match?.[1]) continue
    const packageName = `@voyant-travel/${match[1]}`
    if (seen.has(packageName)) continue
    seen.add(packageName)
    sources.push({ packageName, schema: schemaPath })
  }
  return sources
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
