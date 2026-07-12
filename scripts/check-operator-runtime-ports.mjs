import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"

function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const operatorRoot = argument("--operator-root", "starters/operator")
const frameworkRoot = argument("--framework-root", "packages/framework")
const composition = await readFile(path.join(operatorRoot, "src/api/composition.ts"), "utf8")

function section(source, start, end) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`check-operator-runtime-ports: could not locate ${start}`)
  }
  return source.slice(startIndex, endIndex)
}

const runtimePorts = section(
  composition,
  "export function buildOperatorRuntimePorts",
  "async function createOperatorBookingsRuntimeProvider",
)

const requiredPorts = [
  "actionLedgerHealthRuntimePort",
  "bookingMaintenanceRuntimePort",
  "bookingRequirementsRuntimePort",
  "bookingsRuntimePort",
  "catalogBookingRuntimePort",
  "catalogContentRuntimePort",
  "catalogOffersRuntimePort",
  "catalogSearchRuntimePort",
  "financeBookingScheduleRuntimePort",
  "financeBookingTaxRuntimePort",
  "financeRuntimePort",
  "inventoryBrochureRuntimePort",
  "inventoryRuntimePort",
  "legalContractDocumentRuntimePort",
  "miceRuntimePort",
  "quotesProposalRuntimePort",
  "quotesRuntimePort",
  "quotesSnapshotRuntimePort",
  "smartbillRuntimeHostPort",
  "storefrontCustomerPortalRuntimePort",
  "storefrontPaymentLinkRuntimePort",
  "storefrontRuntimePort",
  "storefrontVerificationRuntimePort",
]

const violations = []
for (const port of requiredPorts) {
  if (!runtimePorts.includes(`[${port}.id]`)) {
    violations.push(`buildOperatorRuntimePorts must bind ${port}.id`)
  }
}

if (composition.includes("operatorGraphCompatibilityModules")) {
  violations.push("operatorGraphCompatibilityModules must stay deleted")
}
if (composition.includes("operatorGraphCompatibilityExtensions")) {
  violations.push("operatorGraphCompatibilityExtensions must stay deleted")
}
for (const symbol of [
  "operatorGraphRuntimeBindings",
  "deploymentLocalExtensions",
  "bindingsFromExtensionFactories",
]) {
  if (composition.includes(symbol)) violations.push(`${symbol} must stay deleted`)
}
if (existsSync(path.join(frameworkRoot, "src/composition-lazy.ts"))) {
  violations.push("framework composition-lazy.ts must stay deleted")
}

if (violations.length > 0) {
  throw new Error(`check-operator-runtime-ports:\n- ${violations.join("\n- ")}`)
}

console.log(
  `check-operator-runtime-ports: OK (${requiredPorts.length} package runtimes are port-bound; central package-id factories are absent)`,
)
