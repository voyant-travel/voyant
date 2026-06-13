import fs from "node:fs"
import path from "node:path"

const repoRoot = process.cwd()

const allowedPublicPackages = new Set([
  "@voyantjs/workflow-runs",
  "@voyantjs/workflows",
  "@voyantjs/workflows-cloud-adapter",
  "@voyantjs/workflows-node-step-container",
  "@voyantjs/workflows-orchestrator",
  "@voyantjs/workflows-orchestrator-cloudflare",
  "@voyantjs/workflows-orchestrator-node",
  "@voyantjs/workflows-react",
  "@voyantjs/workflows-react/ui",
])

const removedWrapperNames = new Set([
  ["@voyantjs", "workflow-runs-ui"].join("/"),
  ...["bindings", "config", "errors"].map((suffix) =>
    ["@voyantjs", `workflows-${suffix}`].join("/"),
  ),
])

function findPackageJsonFiles(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findPackageJsonFiles(fullPath))
      continue
    }

    if (entry.name === "package.json") {
      files.push(fullPath)
    }
  }
  return files
}

const packageJsonFiles = [...findPackageJsonFiles(path.join(repoRoot, "packages"))]
const appsDir = path.join(repoRoot, "apps")
if (fs.existsSync(appsDir)) {
  packageJsonFiles.push(...findPackageJsonFiles(appsDir))
}

const problems = []

for (const packageJsonPath of packageJsonFiles.sort()) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
  if (typeof pkg.name !== "string") continue
  if (!pkg.name.startsWith("@voyantjs/workflow")) continue

  const relativePath = path.relative(repoRoot, packageJsonPath)

  if (removedWrapperNames.has(pkg.name)) {
    problems.push(
      `${relativePath}: ${pkg.name} is a removed compatibility wrapper; use the canonical workflows subpath instead`,
    )
    continue
  }

  if (pkg.private === true) continue

  if (!allowedPublicPackages.has(pkg.name)) {
    problems.push(
      `${relativePath}: ${pkg.name} is not in the documented workflows public package allowlist`,
    )
  }
}

if (problems.length > 0) {
  console.error("Workflows package surface check failed:\n")
  for (const problem of problems) {
    console.error(`  - ${problem}`)
  }
  console.error(
    "\nUpdate docs/architecture/workflows-package-surface.md before adding a new public workflows package.",
  )
  process.exit(1)
}

console.log("Verified workflows public package surface.")
