import { readFile } from "node:fs/promises"
import path from "node:path"

function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const root = argument("--root", ".")
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8")
const contributorRequirements = {
  bookings: "bookingsConfigurationRuntimePort",
  catalog: "createCatalogRuntime",
  commerce: "host.capabilities.loadCommerceRuntime()",
  distribution: "createDistributionRuntime",
  finance: "financeHostRuntimePort",
  flights: "createFlightsRuntime",
  inventory: "host.capabilities.loadInventoryRuntime()",
  legal: "createLegalRuntime",
  notifications: "createNotificationsRuntime",
  quotes: "createQuotesRuntime",
  "workflow-runs": "workflowRunnerRegistryService",
}

const [deploymentResources, ...contributors] = await Promise.all([
  read("starters/operator/src/api/runtime/deployment-resources.ts"),
  ...Object.keys(contributorRequirements).map((packageName) =>
    read(`packages/${packageName}/src/runtime-contributor.ts`),
  ),
])

const violations = []
const generatedCall = deploymentResources.match(
  /createGeneratedGraphRuntimePorts\(\{([\s\S]*?)\n\s*\}\)/,
)?.[1]
if (!generatedCall) {
  violations.push("deployment resources must call createGeneratedGraphRuntimePorts with an object")
} else {
  const keys = [...generatedCall.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*)(?::|,)/gm)].map(
    (match) => match[1],
  )
  if (keys.join(",") !== "capabilities,primitives,host") {
    violations.push(
      `createGeneratedGraphRuntimePorts keys must be exactly capabilities,primitives,host; found ${keys.join(",") || "none"}`,
    )
  }
}

for (const [index, [packageName, requirement]] of Object.entries(
  contributorRequirements,
).entries()) {
  if (!contributors[index].includes(requirement)) {
    violations.push(
      `${packageName} contributor must derive its runtime binding from ${requirement}`,
    )
  }
}

if (generatedCall?.includes("workflowRunnerRegistry,")) {
  violations.push("workflowRunnerRegistry must not be a generated runtime argument key")
}
for (const method of ["resolveDatabase", "resolveConfig", "resolveDocumentStorage"]) {
  if (!generatedCall?.includes(method)) {
    violations.push(`SmartBill host comment must document irreducible ${method}`)
  }
}
if (!generatedCall?.includes("host: operatorSmartbillRuntimeHost")) {
  violations.push("the external SmartBill contributor must retain its typed host resource")
}

if (violations.length > 0) {
  throw new Error(`check-operator-runtime-binding-final:\n- ${violations.join("\n- ")}`)
}

console.log(
  `check-operator-runtime-binding-final: OK (10 package-owned runtime families; ${Object.keys(contributorRequirements).length - 10} legacy capability families)`,
)
