import {
  resolveManagedProfileDeploymentGraph,
  VOYANT_GRAPH_DIAGNOSTIC_CODE_REGISTRY,
} from "../packages/framework/src/deployment-graph.ts"
import { defineVoyantProject } from "../packages/framework/src/profile.ts"

const failures: string[] = []

const project = defineVoyantProject({
  profile: "operator",
  frameworkVersion: "0.0.0-check",
  modules: ["bookings", "finance", "relationships"],
  plugins: ["@voyant-travel/plugin-netopia"],
})

async function main(): Promise<void> {
  const first = await resolveManagedProfileDeploymentGraph(project)
  const second = await resolveManagedProfileDeploymentGraph(project)

  if (first.schemaVersion !== "voyant.resolved-graph.v1") {
    failures.push(`expected resolved graph schema v1, got ${first.schemaVersion}`)
  }

  if (!/^sha256:[a-f0-9]{64}$/.test(first.contentHash)) {
    failures.push(`expected sha256 content hash, got ${first.contentHash}`)
  }

  if (first.contentHash !== second.contentHash) {
    failures.push("expected managed profile graph hash to be deterministic across identical inputs")
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
