import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const rootArg = process.argv.indexOf("--root")
const root = rootArg >= 0 ? resolve(process.argv[rootArg + 1]) : defaultRoot
const starterSource = join(root, "starters/operator/src")
const failures = []

const starterFiles = readdirSync(starterSource, { recursive: true, withFileTypes: true }).filter(
  (entry) => entry.isFile(),
)
if (starterFiles.length > 162) {
  failures.push(`operator starter source grew to ${starterFiles.length} files; ratchet is 162`)
}

for (const relativePath of [
  "starters/operator/src/components/voyant/booking-journey/resolve-contract-variables.test.ts",
  "starters/operator/src/components/voyant/booking-journey/resolve-contract-variables.ts",
  "starters/operator/src/components/voyant/booking-journey/storefront-booking-errors.ts",
  "starters/operator/src/components/voyant/booking-journey/storefront-booking-journey.test.ts",
  "starters/operator/src/components/voyant/booking-journey/storefront-booking-journey.tsx",
  "starters/operator/src/routes/(storefront)/shop-product-detail-accommodations-ui.test.tsx",
  "starters/operator/src/routes/(storefront)/shop-product-detail-accommodations.test.ts",
  "starters/operator/src/routes/(storefront)/shop-product-detail-accommodations.tsx",
  "starters/operator/src/routes/(storefront)/shop-product-detail-content.test.ts",
  "starters/operator/src/routes/(storefront)/shop-product-detail-content.ts",
  "starters/operator/src/routes/(storefront)/shop-product-detail-cruises.test.tsx",
  "starters/operator/src/routes/(storefront)/shop-product-detail-cruises.tsx",
  "starters/operator/src/routes/(storefront)/shop-product-detail-products.tsx",
  "starters/operator/src/routes/(storefront)/shop-product-detail-shared.tsx",
  "starters/operator/src/routes/(storefront)/shop-product-detail-slots.test.ts",
  "starters/operator/src/routes/(storefront)/shop-product-detail-slots.ts",
  "starters/operator/src/routes/(storefront)/shop.test.ts",
]) {
  if (existsSync(join(root, relativePath))) {
    failures.push(`package-owned storefront product UI must stay deleted: ${relativePath}`)
  }
}

for (const relativePath of [
  "starters/operator/src/admin/README.md",
  "starters/operator/src/custom-fields/README.md",
  "starters/operator/src/extensions/README.md",
  "starters/operator/src/modules/README.md",
]) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`project override folder authority requires ${relativePath}`)
  }
}

const requiredTokens = new Map([
  [
    "packages/bookings-react/src/storefront/index.ts",
    ["StorefrontBookingJourney", "resolveContractVariables"],
  ],
  ["packages/bookings-react/package.json", ['"./storefront": "./src/storefront/index.ts"']],
  [
    "packages/catalog-react/src/storefront/index.ts",
    ["fetchContent", "buildPublicCatalogSlotsUrl"],
  ],
  ["packages/catalog-react/package.json", ['"./storefront": "./src/storefront/index.ts"']],
  ["packages/cruises-react/src/storefront/index.ts", ["CruiseDetailPage"]],
  ["packages/cruises-react/package.json", ['"./storefront": "./src/storefront/index.ts"']],
  ["packages/inventory-react/src/storefront/index.ts", ["ProductDetailPageProducts"]],
  ["packages/inventory-react/package.json", ['"./storefront": "./src/storefront/index.ts"']],
  [
    "packages/storefront-react/src/storefront/index.ts",
    ["StorefrontBrowsePage", "AccommodationDetailPage", "StorefrontUiProvider"],
  ],
  ["packages/storefront-react/package.json", ['"./storefront": "./src/storefront/index.ts"']],
  [
    "starters/operator/src/routes/(storefront)/shop_.book.$entityModule.$entityId.tsx",
    ['from "@voyant-travel/bookings-react/storefront"'],
  ],
  [
    "starters/operator/src/routes/(storefront)/shop.tsx",
    ['from "@voyant-travel/storefront-react/storefront"'],
  ],
  [
    "starters/operator/src/routes/(storefront)/shop_.products.$entityModule.$entityId.tsx",
    [
      'from "@voyant-travel/cruises-react/storefront"',
      'from "@voyant-travel/inventory-react/storefront"',
      'from "@voyant-travel/storefront-react/storefront"',
    ],
  ],
  [
    "starters/operator/src/lib/admin-extensions.tsx",
    [
      "../../.voyant/admin/selected-graph-admin.generated",
      'import.meta.glob("../admin/*/index.tsx"',
    ],
  ],
  ["starters/operator/src/router.tsx", ['from "./admin.routes.generated"']],
])

for (const [relativePath, tokens] of requiredTokens) {
  const path = join(root, relativePath)
  if (!existsSync(path)) {
    failures.push(`${relativePath} is required`)
    continue
  }
  const source = readFileSync(path, "utf8")
  for (const token of tokens) {
    if (!source.includes(token)) failures.push(`${relativePath} must contain ${token}`)
  }
}

if (failures.length > 0) {
  console.error("Operator product UI authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Operator product UI authority: OK (${starterFiles.length}/162 starter source files)`)
