import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const rootIndex = process.argv.indexOf("--root")
const root = path.resolve(rootIndex >= 0 ? process.argv[rootIndex + 1] : ".")
const read = (relativePath) => {
  const target = path.join(root, relativePath)
  if (!existsSync(target)) throw new Error(`missing ${relativePath}`)
  return readFileSync(target, "utf8")
}

const sources = {
  deploymentResources: read("starters/operator/src/api/runtime/deployment-resources.ts"),
  actionPackage: read("packages/action-ledger/package.json"),
  actionGraphRuntime: read("packages/action-ledger/src/graph-runtime.ts"),
  actionRuntimePorts: read("packages/action-ledger/src/runtime-port.ts"),
  actionManifest: read("packages/action-ledger/src/voyant.ts"),
  bookingsContributor: read("packages/bookings/src/runtime-contributor.ts"),
  financeContributor: read("packages/finance/src/runtime-contributor.ts"),
  inventoryContributor: read("packages/inventory/src/runtime-contributor.ts"),
  distributionPackage: read("packages/distribution/package.json"),
  distributionAdapterPackage: read("packages/distribution-node/package.json"),
  distributionContributor: read("packages/distribution-node/src/runtime-contributor.ts"),
  workflowContributor: read("packages/workflow-runs/src/runtime-contributor.ts"),
  workflowRunner: read("packages/workflow-runs/src/runner.ts"),
}

const violations = []
for (const [name, source] of Object.entries(sources)) {
  for (const capability of [
    "loadActionLedgerHealthRuntime",
    "loadDistributionChannelPushRuntime",
    "resolveWorkflowRunnerRegistry",
  ]) {
    if (source.includes(capability)) violations.push(`${name} retains ${capability}`)
  }
}
if (sources.actionPackage.includes('"./runtime-contributor"')) {
  violations.push("Action Ledger must not need an empty deployment-target contributor")
}
if (!sources.distributionPackage.includes('"createDistributionRuntimePortContribution"')) {
  violations.push("Distribution domain package must publish its neutral Catalog contributor")
}
for (const [name, source, packageName, factory] of [
  [
    "Distribution",
    sources.distributionAdapterPackage,
    "@voyant-travel/distribution-node",
    "createDistributionNodeRuntimePortContribution",
  ],
]) {
  if (!source.includes(`"name": "${packageName}"`) || !source.includes(`"export": "${factory}"`)) {
    violations.push(`${name} Node adapter metadata is incomplete`)
  }
}
for (const [port, method, contributor] of [
  ["actionLedgerBookingDriftRuntimePort", "checkBookingDrift", sources.bookingsContributor],
  ["actionLedgerFinanceDriftRuntimePort", "checkFinanceDrift", sources.financeContributor],
  ["actionLedgerInventoryDriftRuntimePort", "checkProductDrift", sources.inventoryContributor],
]) {
  if (!sources.actionRuntimePorts.includes(`export const ${port}`)) {
    violations.push(`Action Ledger must declare ${port}`)
  }
  if (!sources.actionManifest.includes(`requirePort(${port})`)) {
    violations.push(`Action Ledger health extension must require ${port}`)
  }
  if (!sources.actionGraphRuntime.includes(`getPort(${port})`)) {
    violations.push(`Action Ledger graph runtime must resolve ${port}`)
  }
  if (!contributor.includes(`[${port}.id]`) || !contributor.includes(method)) {
    violations.push(`${port} must be supplied by its domain contributor`)
  }
}
if (existsSync(path.join(root, "packages/action-ledger-node/package.json"))) {
  violations.push("packages/action-ledger-node must stay deleted")
}
if (!sources.distributionContributor.includes("host.primitives")) {
  violations.push("Distribution Node contributor must use generic host primitives")
}
if (
  !sources.workflowContributor.includes("workflowRunnerRegistryService") ||
  !sources.workflowRunner.includes("activeWorkflowRunnerRegistry = this")
) {
  violations.push("Workflow Runs must bind its package registry service to the app registry")
}
for (const compatibilityPath of [
  "starters/operator/src/api/runtime/action-ledger-health-runtime.ts",
  "starters/operator/src/api/runtime/channel-push-runtime.ts",
]) {
  if (existsSync(path.join(root, compatibilityPath))) {
    violations.push(`${compatibilityPath} must stay deleted`)
  }
}

if (violations.length > 0) {
  throw new Error(
    `check-action-distribution-workflow-runtime-authority:\n- ${violations.join("\n- ")}`,
  )
}

console.log(
  "check-action-distribution-workflow-runtime-authority: OK (Action Ledger static ports, Distribution leaf adapter, and package registry authority)",
)
