import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const pathOption = (name, fallback) => {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value) throw new Error(`${name} requires a path`)
  return value
}
const distributionRoot = pathOption("--distribution-root", join(ROOT, "packages/distribution"))
const distributionNodeRoot = pathOption(
  "--distribution-node-root",
  join(ROOT, "packages/distribution-node"),
)
const operatorRoot = pathOption("--operator-root", join(ROOT, "starters/operator"))
const deploymentGraphCheckerPath = pathOption(
  "--deployment-graph-checker",
  join(ROOT, "scripts/check-deployment-graph.ts"),
)
const violations = []

function readRequired(path) {
  if (!existsSync(path)) {
    throw new Error(`check-distribution-channel-push-runtime-authority: missing ${path}`)
  }
  return readFileSync(path, "utf8")
}

const manifest = readRequired(join(distributionRoot, "src/voyant.ts"))
const extension = readRequired(join(distributionRoot, "src/channel-push/extension.ts"))
const runtimePort = readRequired(join(distributionRoot, "src/channel-push/runtime-port.ts"))
const domainPackage = readRequired(join(distributionRoot, "package.json"))
const adapterPackage = readRequired(join(distributionNodeRoot, "package.json"))
const adapterContributor = readRequired(join(distributionNodeRoot, "src/runtime-contributor.ts"))
const standardRuntime = readRequired(join(distributionNodeRoot, "src/standard-node-runtime.ts"))
const composition = readRequired(join(operatorRoot, "src/api/runtime/deployment-resources.ts"))
const provider = readRequired(join(operatorRoot, "src/api/runtime/channel-push-runtime.ts"))
const workflowServices = readRequired(
  join(operatorRoot, "src/api/runtime/operator-workflow-services.ts"),
)
const deploymentGraphChecker = readRequired(deploymentGraphCheckerPath)

if (
  !manifest.includes("runtimePorts: [requirePort(channelPushRuntimePort)]") ||
  !manifest.includes('export: "createChannelPushVoyantRuntime"')
) {
  violations.push("Distribution manifest must declare the channel-push runtime port and factory")
}
if (
  domainPackage.includes('"./runtime-contributor"') ||
  domainPackage.includes('"export": "createDistributionRuntimePortContribution"')
) {
  violations.push("Distribution domain package must not own the standard Node contributor")
}
if (
  !adapterPackage.includes('"name": "@voyant-travel/distribution-node"') ||
  !adapterPackage.includes('"export": "createDistributionNodeRuntimePortContribution"') ||
  !adapterContributor.includes("configureDistributionStandardNodeRuntime(host.primitives)")
) {
  violations.push("Distribution Node adapter must own generated runtime contribution")
}
for (const required of [
  "getBookingEngineRegistryFromContext",
  "createChannelPushWorkflowRuntimeEntries",
  "primitives.database.resolve",
  "primitives.database.transaction",
]) {
  if (!standardRuntime.includes(required)) {
    violations.push(`Distribution Node runtime must contain ${JSON.stringify(required)}`)
  }
}
if (
  !extension.includes("defineGraphRuntimeFactory") ||
  !extension.includes("getPort(channelPushRuntimePort)") ||
  !extension.includes("runtime.registerWorkflowService(context)")
) {
  violations.push("Distribution must own channel-push route and workflow-service composition")
}
if (
  !runtimePort.includes('id: "distribution.channel-push-runtime"') ||
  !runtimePort.includes("resolveRegistry") ||
  !runtimePort.includes("registerWorkflowService")
) {
  violations.push("Distribution must publish the typed channel-push runtime dependency contract")
}
if (
  composition.includes('from "@voyant-travel/distribution/runtime-contributor"') ||
  composition.includes("createDistributionRuntimePortContribution") ||
  !composition.includes("createGeneratedGraphRuntimePorts")
) {
  violations.push("Operator must bind Distribution through generated contributor composition")
}
if (
  composition.includes('"@voyant-travel/distribution#channel-push-extension"') ||
  composition.includes("createChannelPushExtension")
) {
  violations.push("Operator must not restore the channel-push package-id compatibility binding")
}
if (
  !provider.includes('from "@voyant-travel/distribution-node/standard-node-runtime"') ||
  provider.includes("getBookingEngineRegistryFromContext") ||
  provider.includes("registerDistributionWorkflowService")
) {
  violations.push("Operator channel-push compatibility entrypoint must only forward the adapter")
}
if (
  workflowServices.includes("createChannelPushWorkflowRuntimeEntries") ||
  workflowServices.includes("registerDistributionWorkflowService")
) {
  violations.push("Operator workflow services must not compose Distribution channel-push")
}
if (workflowServices.includes("OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS.distribution")) {
  violations.push("Operator must not restore central Distribution workflow selection")
}
const compatibilityRoutePath = join(operatorRoot, "src/api/routes/channel-push.ts")
if (existsSync(compatibilityRoutePath)) {
  violations.push("src/api/routes/channel-push.ts must stay deleted")
}
if (
  !deploymentGraphChecker.includes(
    'const operatorChannelPushRoutePath = join(operatorRoot, "src/api/routes/channel-push.ts")',
  ) ||
  !deploymentGraphChecker.includes("if (existsSync(operatorChannelPushRoutePath))")
) {
  violations.push(
    "Deployment-graph verification must model the Operator channel-push compatibility route as deleted",
  )
}
if (/readFile\s*\(\s*operatorChannelPushRoutePath/.test(deploymentGraphChecker)) {
  violations.push("Deployment-graph verification must not read the deleted channel-push route")
}

if (violations.length > 0) {
  console.error("Distribution channel-push runtime authority check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log(
  "check-distribution-channel-push-runtime-authority: OK (BOM-selected Node adapter; Operator forwarding-only)",
)
