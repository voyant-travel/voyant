import { readFile } from "node:fs/promises"
import path from "node:path"

function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const root = argument("--root", ".")
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8")
const packageRequirements = {
  "catalog-node": ["host.primitives.env", "ensureBookingEngineRegistry"],
  flights: ["host.capabilities.loadFlightsRuntime()"],
  notifications: ["host.capabilities.loadNotificationsRuntime()"],
  quotes: ["host.capabilities.loadQuoteProposalRuntime()"],
  realtime: ["host.primitives", "createRealtimeStandardNodeRuntime"],
  storage: ["host.primitives", "createStorageStandardNodeRuntime"],
  storefront: ["host.capabilities.loadStorefrontRuntime()"],
  trips: ["host.capabilities.createTripsRoutesOptions", "host.capabilities.withDb"],
}

const [deploymentResources, ...contributors] = await Promise.all([
  read("starters/operator/src/api/runtime/deployment-resources.ts"),
  ...Object.keys(packageRequirements).map((name) =>
    read(`packages/${name}/src/runtime-contributor.ts`),
  ),
])
const generatedCall = deploymentResources.slice(
  deploymentResources.indexOf("return createGeneratedGraphRuntimePorts({"),
)
const explicitBindings = [
  "proposal",
  "snapshot",
  "storefront",
  "paymentLink",
  "customerPortal",
  "verification",
  "cruisesRoutes",
  "flights",
  "notifications",
  "tripsRoutes",
  "tripsDatabase",
  "media",
  "realtime",
]
const violations = []

for (const binding of explicitBindings) {
  if (new RegExp(`\\n    ${binding}:`).test(generatedCall)) {
    violations.push(`deployment-resources.ts must not assemble the ${binding} binding`)
  }
}
if (!/createGeneratedGraphRuntimePorts\(\{\s*capabilities,/s.test(generatedCall)) {
  violations.push("deployment-resources.ts must expose capabilities to generated contributors")
}
for (const [index, [packageName, requirements]] of Object.entries(packageRequirements).entries()) {
  for (const requirement of requirements) {
    if (!contributors[index].includes(requirement)) {
      violations.push(`${packageName} runtime contributor must own ${requirement}`)
    }
  }
}

if (violations.length > 0) {
  throw new Error(`check-operator-capability-runtime-bindings-cut-2:\n- ${violations.join("\n- ")}`)
}

console.log(
  "check-operator-capability-runtime-bindings-cut-2: OK (8 package-owned families from generic host resources)",
)
