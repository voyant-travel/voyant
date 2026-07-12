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
  actionAdapterPackage: read("packages/action-ledger-node/package.json"),
  actionContributor: read("packages/action-ledger-node/src/runtime-contributor.ts"),
  actionRuntime: read("packages/action-ledger-node/src/standard-node-runtime.ts"),
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
  violations.push("Action Ledger domain package retains a target runtime contributor")
}
if (!sources.distributionPackage.includes('"createDistributionRuntimePortContribution"')) {
  violations.push("Distribution domain package must publish its neutral Catalog contributor")
}
for (const [name, source, packageName, factory] of [
  [
    "Action Ledger",
    sources.actionAdapterPackage,
    "@voyant-travel/action-ledger-node",
    "createActionLedgerNodeRuntimePortContribution",
  ],
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
for (const required of [
  "checkBookingActionLedgerDrift",
  "checkFinanceActionLedgerDrift",
  "checkProductActionLedgerDrift",
]) {
  if (!sources.actionRuntime.includes(required)) {
    violations.push(`Action Ledger Node runtime must contain ${required}`)
  }
}
if (!sources.actionContributor.includes("createActionLedgerStandardNodeRuntime")) {
  violations.push("Action Ledger Node contributor must load the standard runtime")
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
  "check-action-distribution-workflow-runtime-authority: OK (leaf adapters and package registry authority)",
)
