import { existsSync } from "node:fs"
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
  commerce: "createCommerceRuntime",
  distribution: "createDistributionRuntime",
  finance: "financeHostRuntimePort",
  flights: "createFlightsRuntime",
  inventory: "createInventoryRuntime(host.primitives)",
  legal: "createLegalRuntime",
  notifications: "createNotificationsRuntime",
  quotes: "createQuotesRuntime",
  "workflow-runs": "new WorkflowRunnerRegistry()",
}

const [deploymentResources, ...contributors] = await Promise.all([
  read("packages/runtime/src/deployment-resources.ts"),
  ...Object.keys(contributorRequirements).map((packageName) =>
    read(`packages/${packageName}/src/runtime-contributor.ts`),
  ),
])

const violations = []
if (existsSync(path.join(root, "starters/operator/src/api/runtime/runtime-adapter.ts"))) {
  violations.push("starters/operator/src/api/runtime/runtime-adapter.ts must stay deleted")
}
const generatedCall = deploymentResources.match(/options\.createRuntimePorts\(\{([^}]*)\}\)/)?.[1]
if (!generatedCall) {
  violations.push("deployment resources must call options.createRuntimePorts with an object")
} else {
  const keys = generatedCall
    .split(",")
    .map((entry) => entry.trim().split(":", 1)[0])
    .filter(Boolean)
  if (keys.join(",") !== "primitives") {
    violations.push(
      `createGeneratedGraphRuntimePorts keys must be exactly primitives; found ${keys.join(",") || "none"}`,
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
if (violations.length > 0) {
  throw new Error(`check-runtime-binding-final:\n- ${violations.join("\n- ")}`)
}

console.log(
  `check-runtime-binding-final: OK (${Object.keys(contributorRequirements).length} package-owned runtime families; 0 legacy capability families)`,
)
