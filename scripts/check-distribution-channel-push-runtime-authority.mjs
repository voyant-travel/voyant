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
  !provider.includes('import type { ChannelPushRuntime } from "@voyant-travel/distribution"') ||
  !provider.includes("getBookingEngineRegistryFromContext") ||
  !provider.includes("registerDistributionWorkflowService")
) {
  violations.push("Operator must provide only the typed Node-host channel-push dependencies")
}
if (
  !workflowServices.includes("createChannelPushWorkflowRuntimeEntries") ||
  !workflowServices.includes("export async function registerDistributionWorkflowService")
) {
  violations.push("Operator must preserve the lazy DB workflow-service adapter")
}
if (workflowServices.includes("OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS.distribution")) {
  violations.push("Operator must not restore central Distribution workflow selection")
}
if (
  !/import\s*\{[^}]*\boperatorBindings\b[^}]*\}\s*from\s*["']\.\/operator-runtime-adapter\.js["']/.test(
    workflowServices,
  )
) {
  violations.push("Distribution workflow bootstrap must import its binding adapter")
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
  "check-distribution-channel-push-runtime-authority: OK (package factory authority; Operator typed-port provider only)",
)
