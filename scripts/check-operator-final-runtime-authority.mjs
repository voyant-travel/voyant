import { readFile } from "node:fs/promises"
import path from "node:path"

function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const root = argument("--root", ".")
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8")
const packagePorts = {
  "action-ledger": ["actionLedgerHealthRuntimePort"],
  auth: ["identityAccessRuntimePort"],
  cruises: ["cruisesRoutesRuntimePort"],
  distribution: ["channelPushRuntimePort"],
  flights: ["flightsRuntimePort"],
  mice: ["miceRuntimePort"],
  notifications: ["notificationsRuntimePort"],
  realtime: ["realtimeRuntimePort"],
  relationships: ["relationshipsRouteRuntimePort"],
  storage: ["storageMediaRuntimePort"],
  trips: ["tripsRoutesRuntimePort", "tripsDatabaseRuntimePort"],
  "workflow-runs": ["workflowRunnerRegistryRuntimePort"],
}
const contributorFactories = [
  "createActionLedgerRuntimePortContribution",
  "createAuthRuntimePortContribution",
  "createCruisesRuntimePortContribution",
  "createDistributionRuntimePortContribution",
  "createFlightsRuntimePortContribution",
  "createMiceRuntimePortContribution",
  "createNotificationsRuntimePortContribution",
  "createRealtimeRuntimePortContribution",
  "createRelationshipsRuntimePortContribution",
  "createStorageRuntimePortContribution",
  "createTripsRuntimePortContribution",
  "createWorkflowRunsRuntimePortContribution",
]

const [deploymentResources, smartbillAdapter, ...contributors] = await Promise.all([
  read("starters/operator/src/api/runtime/deployment-resources.ts"),
  read("starters/operator/src/api/runtime/operator-runtime-adapter.ts"),
  ...Object.keys(packagePorts).map((packageName) =>
    read(`packages/${packageName}/src/runtime-contributor.ts`),
  ),
])

const violations = []
const directRegistrations = deploymentResources.match(/\[[A-Za-z][A-Za-z0-9]*Port\.id\]/g) ?? []
if (directRegistrations.length > 0) {
  violations.push(
    `deployment-resources.ts has ${directRegistrations.length} direct runtime-port registrations; expected zero`,
  )
}

for (const [index, [packageName, ports]] of Object.entries(packagePorts).entries()) {
  const contributor = contributors[index]
  for (const port of ports) {
    if (deploymentResources.includes(port)) {
      violations.push(`deployment-resources.ts must not import or register ${port}`)
    }
    if (!contributor.includes(`[${port}.id]`)) {
      violations.push(`${packageName} runtime contributor must own ${port}`)
    }
  }
}

for (const factory of contributorFactories) {
  if (!deploymentResources.includes(`${factory}(`)) {
    violations.push(`deployment-resources.ts must compose through ${factory}`)
  }
}

if (!deploymentResources.includes("createOperatorSmartbillRuntimePortContribution()")) {
  violations.push(
    "deployment-resources.ts must compose SmartBill through its compatibility contributor",
  )
}
if (!smartbillAdapter.includes("[smartbillRuntimeHostPort.id]")) {
  violations.push("SmartBill compatibility contributor must own smartbillRuntimeHostPort")
}

if (violations.length > 0) {
  throw new Error(`check-operator-final-runtime-authority:\n- ${violations.join("\n- ")}`)
}

const movedCount = Object.values(packagePorts).flat().length
console.log(
  `check-operator-final-runtime-authority: OK (${movedCount} package-owned registrations; 1 external compatibility registration; 0 direct registrations remain)`,
)
