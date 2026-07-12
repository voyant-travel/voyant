import { readFile } from "node:fs/promises"
import path from "node:path"

function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const root = argument("--root", ".")
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8")
const [deploymentResources, storefrontContributor, legalContributor, inventoryContributor] =
  await Promise.all([
    read("starters/operator/src/api/runtime/deployment-resources.ts"),
    read("packages/storefront/src/runtime-contributor.ts"),
    read("packages/legal-node/src/runtime-contributor.ts"),
    read("packages/inventory/src/runtime-contributor.ts"),
  ])

const packagePorts = {
  storefront: [
    "storefrontRuntimePort",
    "storefrontPaymentLinkRuntimePort",
    "storefrontCustomerPortalRuntimePort",
    "storefrontVerificationRuntimePort",
  ],
  legal: [
    "legalRuntimePort",
    "legalContractDocumentRuntimePort",
    "legalBookingContractSubscriberRuntimePort",
  ],
  inventory: ["inventoryRuntimePort", "inventoryBrochureRuntimePort"],
}
const contributors = {
  storefront: storefrontContributor,
  legal: legalContributor,
  inventory: inventoryContributor,
}

const violations = []
for (const [packageName, ports] of Object.entries(packagePorts)) {
  for (const port of ports) {
    if (deploymentResources.includes(port)) {
      violations.push(`deployment-resources.ts must not register or import ${port}`)
    }
    if (!contributors[packageName].includes(`[${port}.id]`)) {
      violations.push(`${packageName} runtime contributor must own ${port}`)
    }
  }
}

for (const factory of [
  "createStorefrontRuntimePortContribution",
  "createLegalNodeRuntimePortContribution",
  "createInventoryRuntimePortContribution",
]) {
  if (deploymentResources.includes(factory)) {
    violations.push(`deployment-resources.ts must not enumerate ${factory}`)
  }
}

const residualRegistrations = deploymentResources.match(/^\s+\[[A-Za-z][A-Za-z0-9]*Port\.id\]/gm)
if ((residualRegistrations?.length ?? 0) > 0) {
  violations.push(
    `deployment-resources.ts has ${residualRegistrations?.length ?? 0} direct runtime-port registrations; expected zero`,
  )
}

if (violations.length > 0) {
  throw new Error(
    `check-operator-storefront-legal-inventory-runtime-authority:\n- ${violations.join("\n- ")}`,
  )
}

const movedCount = Object.values(packagePorts).flat().length
console.log(
  `check-operator-storefront-legal-inventory-runtime-authority: OK (${movedCount} package-owned registrations; ${residualRegistrations?.length ?? 0} direct registrations remain)`,
)
