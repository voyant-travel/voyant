import { readFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const nodeRuntime = await read("packages/framework/src/node-runtime.ts")
const catalogRuntime = await read("packages/catalog/src/graph-runtime.ts")
const catalogMcpRuntime = await read("packages/catalog/src/mcp-runtime.ts")
const commerceManifest = await read("packages/commerce/src/voyant.ts")
const financeManifest = await read("packages/finance/src/voyant.ts")
const legalManifest = await read("packages/legal/src/voyant.ts")
const storageManifest = await read("packages/storage/src/voyant.ts")
const violations = []

const firstPartyReferences = nodeRuntime.match(/@voyant-travel\/[A-Za-z0-9@._/-]+/g) ?? []
const maximumFirstPartyReferences = 44
if (firstPartyReferences.length > maximumFirstPartyReferences) {
  violations.push(
    `framework node-runtime has ${firstPartyReferences.length} first-party references; maximum is ${maximumFirstPartyReferences}`,
  )
}

const selectedProductReferences = firstPartyReferences.filter((reference) =>
  /^@voyant-travel\/(catalog|commerce|finance|legal|storage)(?:\/|$)/.test(reference),
)
const allowedSelectedProductReferences = ["@voyant-travel/finance/order-payment-sessions"]
if (
  selectedProductReferences.length !== allowedSelectedProductReferences.length ||
  selectedProductReferences.some(
    (reference, index) => reference !== allowedSelectedProductReferences[index],
  )
) {
  violations.push(
    `selected product references must equal the documented Flights residual: ${selectedProductReferences.join(", ") || "none"}`,
  )
}

for (const field of [
  "createInvoiceExchangeRateResolver",
  "createOperatorDocumentStorage",
  "loadBookingMaintenanceRoutes",
  "loadBookingScheduleAdminRoutes",
  "loadCatalogBookingRoutes",
  "loadCatalogCheckoutRoutes",
  "loadCatalogOffersRoutes",
  "loadContractDocumentRoutes",
  "loadPaymentPolicyPublicRoutes",
  "loadStorageRoutes",
  "resolveCatalogRuntime",
  "resolveCardPaymentStarter",
]) {
  if (nodeRuntime.includes(field)) {
    violations.push(`ManagedProfileProviders must not regain product authority field ${field}`)
  }
}

for (const [source, required] of [
  [catalogRuntime, "createCatalogBookingVoyantRuntime"],
  [catalogRuntime, "createCatalogOffersVoyantRuntime"],
  [catalogMcpRuntime, "voyantToolContextContribution"],
  [commerceManifest, "commerceCatalogCheckoutVoyantPlugin"],
  [commerceManifest, "commerceBookingMaintenanceVoyantPlugin"],
  [financeManifest, "financeBookingScheduleVoyantPlugin"],
  [legalManifest, "legalContractDocumentVoyantModule"],
  [storageManifest, "storageMediaRuntimePort"],
]) {
  if (!source.includes(required)) violations.push(`package authority is missing ${required}`)
}

if (violations.length > 0) {
  throw new Error(`check-node-runtime-product-authority:\n- ${violations.join("\n- ")}`)
}

console.log(
  `check-node-runtime-product-authority: OK (${firstPartyReferences.length}/${maximumFirstPartyReferences} first-party references; one documented Finance/Flights residual)`,
)

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8")
}
