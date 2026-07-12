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
if (starterFiles.length > 194) {
  failures.push(`operator starter source grew to ${starterFiles.length} files; ratchet is 194`)
}

for (const relativePath of [
  "starters/operator/src/components/voyant/booking-journey/resolve-contract-variables.test.ts",
  "starters/operator/src/components/voyant/booking-journey/resolve-contract-variables.ts",
  "starters/operator/src/components/voyant/booking-journey/storefront-booking-errors.ts",
  "starters/operator/src/components/voyant/booking-journey/storefront-booking-journey.test.ts",
  "starters/operator/src/components/voyant/booking-journey/storefront-booking-journey.tsx",
]) {
  if (existsSync(join(root, relativePath))) {
    failures.push(`package-owned storefront booking code must stay deleted: ${relativePath}`)
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
    "starters/operator/src/routes/(storefront)/shop_.book.$entityModule.$entityId.tsx",
    ['from "@voyant-travel/bookings-react/storefront"'],
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

console.log(`Operator product UI authority: OK (${starterFiles.length}/194 starter source files)`)
