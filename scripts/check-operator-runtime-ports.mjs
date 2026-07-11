import { readFile } from "node:fs/promises"
import path from "node:path"

function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const operatorRoot = argument("--operator-root", "starters/operator")
const frameworkRoot = argument("--framework-root", "packages/framework")
const composition = await readFile(path.join(operatorRoot, "src/api/composition.ts"), "utf8")
const frameworkComposition = await readFile(
  path.join(frameworkRoot, "src/composition-lazy.ts"),
  "utf8",
)

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
const runtimeBindings = section(
  composition,
  "export const operatorGraphRuntimeBindings",
  "function bindingsFromExtensionFactories",
)

const requiredPorts = [
  "accommodationsContentRuntimePort",
  "actionLedgerHealthRuntimePort",
  "bookingMaintenanceRuntimePort",
  "bookingRequirementsRuntimePort",
  "bookingsRuntimePort",
  "catalogBookingRuntimePort",
  "catalogOffersRuntimePort",
  "catalogSearchRuntimePort",
  "cruisesContentRuntimePort",
  "financeBookingScheduleRuntimePort",
  "financeBookingTaxRuntimePort",
  "financeRuntimePort",
  "inventoryBrochureRuntimePort",
  "inventoryContentRuntimePort",
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

const migratedGraphIds = [
  "@voyant-travel/accommodations#content-extension",
  "@voyant-travel/action-ledger#health-extension",
  "@voyant-travel/bookings",
  "@voyant-travel/bookings#requirements",
  "@voyant-travel/catalog",
  "@voyant-travel/catalog#booking-engine",
  "@voyant-travel/catalog#offers-extension",
  "@voyant-travel/commerce#booking-maintenance-extension",
  "@voyant-travel/cruises#content-extension",
  "@voyant-travel/finance",
  "@voyant-travel/finance#booking-schedule-extension",
  "@voyant-travel/finance#booking-tax-extension",
  "@voyant-travel/inventory",
  "@voyant-travel/inventory#brochure-extension",
  "@voyant-travel/inventory#content-extension",
  "@voyant-travel/legal#contract-document",
  "@voyant-travel/mice",
  "@voyant-travel/quotes",
  "@voyant-travel/quotes#proposal-extension",
  "@voyant-travel/quotes#quote-version-snapshot-extension",
  "@voyant-travel/storefront",
  "@voyant-travel/storefront#customer-portal",
  "@voyant-travel/storefront#payment-link",
  "@voyant-travel/storefront#verification",
]

const violations = []
for (const port of requiredPorts) {
  if (!runtimePorts.includes(`[${port}.id]`)) {
    violations.push(`buildOperatorRuntimePorts must bind ${port}.id`)
  }
}

for (const graphId of migratedGraphIds) {
  if (runtimeBindings.includes(`"${graphId}"`)) {
    violations.push(`${graphId} must not return to package-keyed Operator bindings`)
  }
  if (frameworkComposition.includes(`"${graphId.replace("#", "/")}":`)) {
    violations.push(`${graphId} must not return to frameworkComposition`)
  }
}

if (composition.includes("operatorGraphCompatibilityModules")) {
  violations.push("operatorGraphCompatibilityModules must stay deleted")
}
if (composition.includes("operatorGraphCompatibilityExtensions")) {
  violations.push("operatorGraphCompatibilityExtensions must stay deleted")
}

if (violations.length > 0) {
  throw new Error(`check-operator-runtime-ports:\n- ${violations.join("\n- ")}`)
}

console.log(
  `check-operator-runtime-ports: OK (${requiredPorts.length} package runtimes are port-bound; central package-id factories are absent)`,
)
