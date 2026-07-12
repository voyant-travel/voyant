import { readFile } from "node:fs/promises"
import path from "node:path"

function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const root = path.resolve(argument("--root", "."))
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8")
const packageFactories = {
  "action-ledger-node": "createActionLedgerNodeRuntimePortContribution",
  auth: "createAuthRuntimePortContribution",
  "bookings-node": "createBookingsNodeRuntimePortContribution",
  "catalog-node": "createCatalogNodeRuntimePortContribution",
  commerce: "createCommerceRuntimePortContribution",
  "distribution-node": "createDistributionNodeRuntimePortContribution",
  "finance-node": "createFinanceNodeRuntimePortContribution",
  flights: "createFlightsRuntimePortContribution",
  inventory: "createInventoryRuntimePortContribution",
  legal: "createLegalRuntimePortContribution",
  mice: "createMiceRuntimePortContribution",
  notifications: "createNotificationsRuntimePortContribution",
  quotes: "createQuotesRuntimePortContribution",
  realtime: "createRealtimeRuntimePortContribution",
  relationships: "createRelationshipsRuntimePortContribution",
  storage: "createStorageRuntimePortContribution",
  storefront: "createStorefrontRuntimePortContribution",
  trips: "createTripsRuntimePortContribution",
  "workflow-runs": "createWorkflowRunsRuntimePortContribution",
}

const [deploymentResources, adapter, generator, frameworkContributors, ...packageJsonSources] =
  await Promise.all([
    read("starters/operator/src/api/runtime/deployment-resources.ts"),
    read("starters/operator/src/api/runtime/operator-runtime-adapter.ts"),
    read("packages/framework/src/deployment-artifacts.ts"),
    read("packages/framework/src/runtime-contributors.generated.ts"),
    ...Object.keys(packageFactories).map((packageName) =>
      read(`packages/${packageName}/package.json`),
    ),
  ])

const violations = []
if (/from\s+["'][^"']+\/runtime-contributor["']/.test(deploymentResources)) {
  violations.push("Operator deployment resources must not import package runtime contributors")
}
if (/create[A-Za-z0-9]+RuntimePortContribution/.test(deploymentResources)) {
  violations.push("Operator deployment resources must not call package runtime contributors")
}
if (!deploymentResources.includes("return createGeneratedGraphRuntimePorts({")) {
  violations.push("Operator must compose one generated contributor set from opaque host resources")
}
if (/createOperatorSmartbillRuntimePortContribution|smartbillRuntimeHostPort/.test(adapter)) {
  violations.push("Operator SmartBill adapter must not retain a compatibility contributor")
}
for (const required of [
  "GENERATED_GRAPH_RUNTIME_CONTRIBUTORS",
  "GENERATED_GRAPH_RUNTIME_CONTRIBUTOR_SPECIFIERS",
  "GeneratedGraphRuntimeContributorHost",
  "Parameters<typeof GENERATED_RUNTIME_CONTRIBUTOR_",
  "createGeneratedGraphRuntimePorts",
  "record.metadata?.runtime",
  "input.runtimeEntryOverrides?.[entry]",
  "contributor.importEntry",
]) {
  if (!generator.includes(required)) {
    violations.push(`graph runtime generator must contain ${required}`)
  }
}
if (
  !generator.includes("contributor.exportName") ||
  !generator.includes("as GENERATED_RUNTIME_CONTRIBUTOR_")
) {
  violations.push("graph runtime contributors must be emitted as static imports")
}
if (/require\s*\(|createRequire/.test(generator)) {
  violations.push("graph runtime contributor lowering must not add runtime require")
}

for (const [index, [packageName, factory]] of Object.entries(packageFactories).entries()) {
  const packageJson = JSON.parse(packageJsonSources[index])
  const runtime = packageJson.voyant?.runtime
  if (runtime?.entry !== "./runtime-contributor" || runtime?.export !== factory) {
    violations.push(`${packageName} must declare its package-owned runtime contributor metadata`)
  }
  if (!packageJson.exports?.["./runtime-contributor"]) {
    violations.push(`${packageName} must export ./runtime-contributor`)
  }
  if (
    !frameworkContributors.includes(
      `export { ${factory} } from "@voyant-travel/${packageName}/runtime-contributor"`,
    )
  ) {
    violations.push(`${packageName} must be reachable through the generated framework barrel`)
  }
}

if (violations.length > 0) {
  throw new Error(`check-generated-runtime-contributor-authority:\n- ${violations.join("\n- ")}`)
}

console.log(
  `check-generated-runtime-contributor-authority: OK (${Object.keys(packageFactories).length} package contributors statically selected; 0 starter imports or calls)`,
)
