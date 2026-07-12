import { readFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const nodeRuntime = await read("packages/framework/src/node-runtime.ts")
const violations = []

// The resident host may import only generic process, auth, database, storage,
// composition, and workflow infrastructure. Each exception is intentionally
// exact so adding another first-party dependency requires architectural review.
const allowedInfrastructureImports = new Map([
  [
    "@voyant-travel/action-ledger/capability",
    "lowers graph action declarations into the generic runtime capability registry",
  ],
  ["@voyant-travel/auth/cloud-admin-session", "implements the Node Cloud admin auth adapter"],
  ["@voyant-travel/auth/cloud-broker", "implements the Node Cloud auth redirect exchange"],
  ["@voyant-travel/auth/server", "constructs the generic Node auth handler"],
  ["@voyant-travel/db/runtime", "constructs the Node database and database-backed stores"],
  ["@voyant-travel/db/schema/iam", "reads the infrastructure-owned auth identity schema"],
  ["@voyant-travel/hono", "provides the generic HTTP, auth, database, and rate-limit contracts"],
  ["@voyant-travel/hono/composition", "types deployment-local graph factories"],
  ["@voyant-travel/runtime", "provides the resident Node server and storage shims"],
  ["@voyant-travel/types/member-roles", "maps authenticated infrastructure roles to scopes"],
  ["@voyant-travel/utils/cache", "types the generic cache resource"],
  ["@voyant-travel/utils/redis-kv", "adapts Redis to the generic cache resource"],
  ["@voyant-travel/utils/tiered-kv", "composes process and durable cache resources"],
  ["@voyant-travel/workflows/client", "adapts the generic workflow driver to Voyant Cloud"],
  ["@voyant-travel/workflows-orchestrator/in-memory", "provides the local workflow driver"],
])

const firstPartyImports = extractFirstPartyImports(nodeRuntime)
const productImports = firstPartyImports.filter(
  (specifier) => !allowedInfrastructureImports.has(specifier),
)
if (productImports.length > 0) {
  violations.push(
    `framework node-runtime must have zero first-party product imports; found ${productImports.join(", ")}`,
  )
}

for (const [specifier, justification] of allowedInfrastructureImports) {
  if (!justification.trim()) {
    violations.push(`infrastructure import ${specifier} has no justification`)
  }
  if (!firstPartyImports.includes(specifier)) {
    violations.push(`stale infrastructure import exception must be removed: ${specifier}`)
  }
}

for (const forbidden of [
  "ManagedProfileProviders",
  "VoyantNodeRuntimeProviders",
  "createManagedProfileProviders",
  "buildManagedToolContext",
  "createManagedMcpAdminRoutes",
  "loadFlightAdminRoutes",
  "loadMcpAdminRoutes",
  "loadProposalAdminRoutes",
  "loadProposalPublicRoutes",
  "loadQuoteVersionSnapshotRoutes",
  "resolveNotificationProviders",
  "storefrontIntakePersistence",
]) {
  if (nodeRuntime.includes(forbidden)) {
    violations.push(`framework node-runtime must not retain product authority ${forbidden}`)
  }
}

for (const required of ["VoyantNodeRuntimeResources", "runtimePorts?:"]) {
  if (!nodeRuntime.includes(required)) {
    violations.push(`generic graph runtime host contract is missing ${required}`)
  }
}

const packageAuthority = [
  ["packages/accommodations/src/voyant.ts", "createAccommodationsContentVoyantRuntime"],
  ["packages/bookings/src/voyant.ts", "createBookingsVoyantRuntime"],
  ["packages/bookings/src/voyant.ts", "createBookingRequirementsVoyantRuntime"],
  ["packages/catalog/src/graph-runtime.ts", "createCatalogBookingVoyantRuntime"],
  ["packages/catalog/src/graph-runtime.ts", "createCatalogOffersVoyantRuntime"],
  ["packages/catalog/src/mcp-runtime.ts", "voyantToolContextContribution"],
  ["packages/commerce/src/voyant.ts", "commerceCatalogCheckoutVoyantPlugin"],
  ["packages/commerce/src/voyant.ts", "commerceBookingMaintenanceVoyantPlugin"],
  ["packages/finance/src/voyant.ts", "financeBookingScheduleVoyantPlugin"],
  ["packages/flights/src/voyant.ts", "createFlightsVoyantRuntime"],
  ["packages/inventory/src/voyant.ts", "createInventoryVoyantRuntime"],
  ["packages/legal/src/voyant.ts", "legalContractDocumentVoyantModule"],
  ["packages/notifications/src/voyant.ts", "createNotificationsVoyantRuntime"],
  ["packages/quotes/src/voyant.ts", "createQuoteProposalVoyantRuntime"],
  ["packages/relationships/src/voyant.ts", "createRelationshipsVoyantRuntime"],
  ["packages/storage/src/voyant.ts", "storageMediaRuntimePort"],
  ["packages/storefront/src/voyant.ts", "createStorefrontVoyantRuntime"],
  ["packages/trips/src/voyant.ts", "createTripsVoyantRuntime"],
]

for (const [relativePath, required] of packageAuthority) {
  const source = await read(relativePath)
  if (!source.includes(required)) {
    violations.push(`package authority is missing ${required} in ${relativePath}`)
  }
}

if (violations.length > 0) {
  throw new Error(`check-node-runtime-product-authority:\n- ${violations.join("\n- ")}`)
}

console.log(
  `check-node-runtime-product-authority: OK (0 product imports; ${firstPartyImports.length} explicitly justified infrastructure imports)`,
)

function extractFirstPartyImports(source) {
  const imports = [
    ...source.matchAll(/\bfrom\s+["'](@voyant-travel\/[A-Za-z0-9@._/-]+)["']/g),
    ...source.matchAll(/\bimport\s*\(\s*["'](@voyant-travel\/[A-Za-z0-9@._/-]+)["']\s*\)/g),
  ].map((match) => match[1])
  return [...new Set(imports)].sort()
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8")
}
