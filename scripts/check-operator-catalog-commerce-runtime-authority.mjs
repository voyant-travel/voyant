import { readFile } from "node:fs/promises"
import path from "node:path"

function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const root = argument("--root", ".")
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8")
const [deploymentResources, catalogContributor, commerceContributor] = await Promise.all([
  read("starters/operator/src/api/runtime/deployment-resources.ts"),
  read("packages/catalog-node/src/runtime-contributor.ts"),
  read("packages/commerce/src/runtime-contributor.ts"),
])

const catalogPorts = [
  "catalogSearchRuntimePort",
  "catalogBookingRuntimePort",
  "catalogOffersRuntimePort",
  "catalogContentRuntimePort",
  "catalogProjectionRuntimePort",
  "catalogBookingSnapshotRuntimePort",
]
const commercePorts = [
  "bookingMaintenanceRuntimePort",
  "catalogCheckoutApiRuntimePort",
  "catalogCheckoutDatabaseRuntimePort",
  "catalogCheckoutLegalRuntimePort",
  "catalogCheckoutContractPdfRuntimePort",
  "promotionRedemptionDatabaseRuntimePort",
  "promotionsBulkReindexRuntimePort",
]

const violations = []
for (const port of [...catalogPorts, ...commercePorts]) {
  if (deploymentResources.includes(port)) {
    violations.push(`deployment-resources.ts must not register or import ${port}`)
  }
}
for (const required of [
  "createCatalogNodeRuntimePortContribution",
  "createCommerceRuntimePortContribution",
]) {
  if (deploymentResources.includes(required)) {
    violations.push(`deployment-resources.ts must not enumerate ${required}`)
  }
}
for (const port of catalogPorts) {
  if (!catalogContributor.includes(`[${port}.id]`)) {
    violations.push(`Catalog runtime contributor must own ${port}`)
  }
}
for (const port of commercePorts) {
  if (!commerceContributor.includes(`[${port}.id]`)) {
    violations.push(`Commerce runtime contributor must own ${port}`)
  }
}

if (violations.length > 0) {
  throw new Error(
    `check-operator-catalog-commerce-runtime-authority:\n- ${violations.join("\n- ")}`,
  )
}

console.log(
  `check-operator-catalog-commerce-runtime-authority: OK (${catalogPorts.length + commercePorts.length} package-owned registrations)`,
)
