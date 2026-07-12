import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const failures = []
const starterFiles = [
  "src/components/providers.tsx",
  "src/components/providers/user-provider.tsx",
  "src/components/realtime-live.tsx",
  "src/lib/admin-destinations.ts",
  "src/lib/admin-extensions.tsx",
  "src/lib/admin-i18n.ts",
  "src/lib/admin-i18n.tsx",
]
const starterRoot = join(root, "starters/operator")
const lineRatchet = 147

const lines = starterFiles.reduce((total, relativePath) => {
  const path = join(starterRoot, relativePath)
  if (!existsSync(path)) return total
  return total + readFileSync(path, "utf8").split("\n").length
}, 0)
if (lines > lineRatchet) {
  failures.push(
    `operator admin presentation glue grew to ${lines} lines; ratchet is ${lineRatchet}`,
  )
}

const forbidden = ["starters/operator/src/lib/dashboard-ssr-query-options.ts"]
for (const relativePath of forbidden) {
  if (existsSync(join(root, relativePath))) {
    failures.push(`package-owned admin presentation must stay deleted: ${relativePath}`)
  }
}

const requiredTokens = new Map([
  [
    "starters/operator/src/lib/admin-extensions.tsx",
    [
      "../../.voyant/admin/selected-graph-admin.generated",
      'import.meta.glob("../admin/*/index.tsx"',
      "createAdminHostExtensions",
    ],
  ],
  [
    "starters/operator/src/lib/admin-destinations.ts",
    ["adminExtensions", "createAdminHostDestinations"],
  ],
  [
    "packages/admin-host/src/admin-presentation.ts",
    ["loadAdminDashboard", "discoverAdminHostExtensions", "selected({ navMessages })"],
  ],
  [
    "packages/realtime-react/src/admin.tsx",
    ["AdminRealtimeProvider", "ADMIN_INVALIDATIONS", "hasAdminRealtimeSession"],
  ],
  ["packages/admin-react/src/user-bindings.tsx", ["createAdminUserBindings"]],
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
  console.error("Operator admin presentation authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Operator admin presentation authority: OK (${lines}/${lineRatchet} starter lines)`)
