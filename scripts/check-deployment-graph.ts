import {
  canonicalJson,
  resolveManagedProfileDeploymentGraph,
  VOYANT_GRAPH_DIAGNOSTIC_CODE_REGISTRY,
} from "../packages/framework/src/deployment-graph.ts"
import { defineVoyantProject } from "../packages/framework/src/profile.ts"
import { readPnpmLockfilePackageRecords } from "./lib/deployment-graph-provenance.mjs"

const failures: string[] = []

const project = defineVoyantProject({
  profile: "operator",
  frameworkVersion: "0.0.0-check",
  modules: ["bookings", "finance", "relationships"],
  plugins: ["@voyant-travel/plugin-netopia"],
})

async function main(): Promise<void> {
  const discoveredGraph = await resolveManagedProfileDeploymentGraph(project)
  const packageRecords = readPnpmLockfilePackageRecords({
    packageNames: discoveredGraph.packageRecords.map((record) => record.packageName),
  })
  const first = await resolveManagedProfileDeploymentGraph(project, { packageRecords })
  const second = await resolveManagedProfileDeploymentGraph(project, { packageRecords })

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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
