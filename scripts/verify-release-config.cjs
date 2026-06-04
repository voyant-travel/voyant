const { readFileSync } = require("node:fs")
const path = require("node:path")

const { read } = require("@changesets/config")
const { getPackages } = require("@manypkg/get-packages")

const { getPublishablePackages } = require("./release-utils.cjs")

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]
const REQUIRED_WORKSPACE_RANGE = "workspace:^"

function collectWorkspaceRangeProblems(packages) {
  const problems = []
  const workspacePackageNames = new Set(
    packages.packages.map((pkg) => pkg.packageJson.name).filter(Boolean),
  )

  for (const pkg of packages.packages) {
    const packageJsonPath = path.join(pkg.dir, "package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))

    for (const field of DEPENDENCY_FIELDS) {
      const dependencies = packageJson[field]
      if (!dependencies || typeof dependencies !== "object") continue

      for (const [name, version] of Object.entries(dependencies)) {
        if (workspacePackageNames.has(name) && version !== REQUIRED_WORKSPACE_RANGE) {
          problems.push(
            `${packageJsonPath}: ${field}.${name} uses ${version}; expected ${REQUIRED_WORKSPACE_RANGE}`,
          )
        }
      }
    }
  }

  return problems
}

async function main() {
  const cwd = process.cwd()
  const packages = await getPackages(cwd)
  const config = await read(cwd, packages)
  const publishableNames = new Set(
    getPublishablePackages(packages, config).map((pkg) => pkg.packageJson.name),
  )
  const seenFixedPackages = new Map()
  const problems = []

  for (const group of config.fixed) {
    if (group.length < 2) {
      problems.push(`fixed group must contain at least two packages: ${group.join(", ")}`)
    }

    for (const packageName of group) {
      if (!publishableNames.has(packageName)) {
        problems.push(`fixed group references non-publishable package: ${packageName}`)
      }

      if (packageName.endsWith("-contracts")) {
        problems.push(`contract package must version independently: ${packageName}`)
      }

      const previousGroup = seenFixedPackages.get(packageName)
      if (previousGroup) {
        problems.push(
          `${packageName} appears in multiple fixed groups: ${previousGroup.join(
            ", ",
          )} and ${group.join(", ")}`,
        )
      }
      seenFixedPackages.set(packageName, group)
    }
  }

  problems.push(...collectWorkspaceRangeProblems(packages))

  if (problems.length > 0) {
    console.error("Release configuration verification failed:\n")
    for (const problem of problems) {
      console.error(`- ${problem}`)
    }
    process.exit(1)
  }

  console.log(
    `Verified ${config.fixed.length} release cohorts and compatible @voyantjs workspace ranges.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
