/**
 * Verifies that the authored standard Operator distribution is the only
 * standard product membership authority. Publish dependencies may be generated
 * from it, but no generated package list may feed graph resolution.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const DISTRIBUTION = join(ROOT, "packages/operator-standard/src/index.ts")
const PRODUCT_DISTRIBUTION_PACKAGE = join(ROOT, "packages/operator-standard/package.json")
const RETIRED_INPUTS = [
  "release.runtime-packages.generated.json",
  "packages/framework/src/runtime-packages.generated.ts",
  "packages/framework/src/runtime-contributors.generated.ts",
]

const distributionSource = readFileSync(DISTRIBUTION, "utf8")
const policyStart = distributionSource.indexOf("export const STANDARD_OPERATOR_DISTRIBUTION_POLICY")
const policyEnd = distributionSource.indexOf(
  "export const STANDARD_OPERATOR_PRODUCT_BOM",
  policyStart,
)
if (policyStart < 0 || policyEnd < 0) {
  throw new Error("operator-distribution.ts: standard distribution policy boundary not found")
}
const standardPackages = [
  ...new Set(
    [
      ...distributionSource
        .slice(policyStart, policyEnd)
        .matchAll(/resolve:\s*"(@voyant-travel\/[^"/]+)/g),
    ].map((match) => match[1]),
  ),
].sort()
const workspacePackages = readWorkspacePackages()
const productDistribution = JSON.parse(readFileSync(PRODUCT_DISTRIBUTION_PACKAGE, "utf8"))
const violations = []

if (standardPackages.length === 0) {
  violations.push("authored standard distribution must select at least one package")
}
for (const packageName of standardPackages) {
  const manifest = workspacePackages.get(packageName)
  if (!manifest) {
    violations.push(`standard distribution package ${packageName} is not a workspace package`)
    continue
  }
  if (manifest.voyant?.schemaVersion !== "voyant.package.v1") {
    violations.push(`${packageName} must own voyant.package.v1 metadata`)
  }
  if (!productDistribution.dependencies?.[packageName]) {
    violations.push(`product distribution is missing ${packageName}`)
  }
}

for (const relativePath of RETIRED_INPUTS) {
  if (existsSync(join(ROOT, relativePath))) {
    violations.push(`${relativePath} is a retired generated resolver input and must stay deleted`)
  }
}

for (const [packageName, version] of Object.entries(productDistribution.dependencies ?? {})) {
  if (workspacePackages.has(packageName) && version !== "workspace:*") {
    violations.push(
      `product distribution must pin workspace package ${packageName} with workspace:*`,
    )
  }
}

if (violations.length > 0) {
  throw new Error(`Standard product membership violation:\n- ${violations.join("\n- ")}`)
}

console.log(
  `check-lockstep-membership: OK (${standardPackages.length} authored standard product packages; 0 generated resolver inputs)`,
)

function readWorkspacePackages() {
  const packages = new Map()
  visit(join(ROOT, "packages"), packages)
  return packages
}

function visit(directory, packages) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "coverage", ".turbo"].includes(entry.name)) continue
    const target = join(directory, entry.name)
    if (!entry.isDirectory()) continue
    const packageJson = join(target, "package.json")
    if (existsSync(packageJson)) {
      const manifest = JSON.parse(readFileSync(packageJson, "utf8"))
      if (manifest.name) packages.set(manifest.name, manifest)
    }
    if (statSync(target).isDirectory()) visit(target, packages)
  }
}
