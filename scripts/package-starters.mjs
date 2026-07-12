import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const args = parseArgs(process.argv.slice(2))
const version = resolveVersion(args.version)
const outDir = resolve(repoRoot, args.outDir ?? ".release/starters")
const starters = ["operator"]
const catalogVersions = readCatalogVersions()
const workspaceVersions = readWorkspaceVersions()

mkdirSync(outDir, { recursive: true })

for (const starter of starters) {
  const stagingRoot = mkdtempSync(join(tmpdir(), `voyant-starter-${starter}-`))
  const stagingTemplate = join(stagingRoot, "template")

  try {
    stageMinimalOperatorStarter(stagingTemplate, args.localLinks === true)

    const archivePath = join(outDir, assetFileName(starter, version))
    execFileSync("tar", ["-czf", archivePath, "-C", stagingTemplate, "."], {
      stdio: "inherit",
    })
    console.log(`Packaged ${starter}: ${archivePath}`)
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true })
  }
}

function stageMinimalOperatorStarter(stagingTemplate, localLinks) {
  mkdirSync(stagingTemplate, { recursive: true })
  for (const directory of [
    "src/api/admin",
    "src/api/public",
    "src/admin",
    "src/modules",
    "src/workflows",
    "src/jobs",
    "src/subscribers",
    "src/links",
    "src/scripts",
  ]) {
    mkdirSync(join(stagingTemplate, directory), { recursive: true })
  }

  const dependency = (name) =>
    localLinks ? `link:${workspacePackageDirectory(name)}` : `^${requiredWorkspaceVersion(name)}`
  const cliDependency = localLinks
    ? `link:${resolve(repoRoot, "..", "cli", "packages", "cli")}`
    : `^${version}`
  const startCommand = localLinks
    ? `tsx ${join(workspacePackageDirectory("@voyant-travel/operator-runtime"), "src/cli.ts")}`
    : "voyant-operator start"
  const buildCommand = localLinks ? "NODE_OPTIONS=--import=tsx voyant build" : "voyant build"
  const localBomDependencies = localLinks
    ? Object.fromEntries(
        Object.keys(readJson(join(repoRoot, "packages/framework/package.json")).dependencies)
          .filter((name) => workspaceVersions.has(name))
          .map((name) => [name, `link:${workspacePackageDirectory(name)}`]),
      )
    : {}
  writeJson(join(stagingTemplate, "package.json"), {
    name: "voyant-app",
    private: true,
    license: "Apache-2.0",
    type: "module",
    scripts: {
      dev: `${buildCommand} && ${startCommand}`,
      build: buildCommand,
      start: startCommand,
      "graph:emit": buildCommand,
      seed: "tsx src/scripts/seed.ts",
    },
    dependencies: {
      ...localBomDependencies,
      "@voyant-travel/framework": dependency("@voyant-travel/framework"),
      "@voyant-travel/operator-runtime": dependency("@voyant-travel/operator-runtime"),
    },
    devDependencies: {
      "@voyant-travel/cli": cliDependency,
      tsx: catalogVersions.get("tsx"),
      typescript: catalogVersions.get("typescript"),
    },
  })
  writeFileSync(
    join(stagingTemplate, "voyant.config.ts"),
    `import { defineConfig } from "@voyant-travel/framework/project"

export default defineConfig({
  deployment: {
    target: "node",
    providers: { database: "postgres" },
  },
})
`,
  )
  writeFileSync(
    join(stagingTemplate, ".env.example"),
    `${["postgresql", "://postgres:postgres@localhost:5432/voyant"].join("")}\nPORT=8080\n`,
  )
  writeFileSync(
    join(stagingTemplate, "src/scripts/seed.ts"),
    'console.info("Add project seed data here.")\n',
  )
}

function requiredWorkspaceVersion(name) {
  const value = workspaceVersions.get(name)
  if (!value) throw new Error(`Missing workspace package for starter dependency: ${name}`)
  return value
}

function workspacePackageDirectory(name) {
  for (const root of ["packages", join("packages", "plugins"), "apps"]) {
    const rootPath = join(repoRoot, root)
    if (!existsSync(rootPath)) continue
    for (const entry of readdirSync(rootPath)) {
      const directory = join(rootPath, entry)
      const packageJsonPath = join(directory, "package.json")
      if (!existsSync(packageJsonPath)) continue
      if (readJson(packageJsonPath).name === name) return directory
    }
  }
  throw new Error(`Missing workspace package directory for ${name}`)
}

function readCatalogVersions() {
  const text = readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8")
  const versions = new Map()
  let inCatalog = false
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "catalog:") {
      inCatalog = true
      continue
    }
    if (!inCatalog) continue
    if (!line.startsWith("  ")) break
    const match = line.match(/^\s+"?([^":]+)"?:\s+(.+)$/)
    if (match) versions.set(match[1], match[2].trim())
  }
  return versions
}

function readWorkspaceVersions() {
  const versions = new Map()
  for (const root of ["packages", join("packages", "plugins"), "apps"]) {
    const rootPath = join(repoRoot, root)
    if (!existsSync(rootPath)) continue
    for (const entry of readdirSync(rootPath)) {
      const packageDir = join(rootPath, entry)
      if (!statSync(packageDir).isDirectory()) continue
      const packageJsonPath = join(packageDir, "package.json")
      if (!existsSync(packageJsonPath)) continue
      const packageJson = readJson(packageJsonPath)
      if (packageJson.name && packageJson.version) {
        versions.set(packageJson.name, packageJson.version)
      }
    }
  }
  return versions
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function assetFileName(starter, version) {
  return `voyant-starter-${starter}-${version}.tar.gz`
}

function parseArgs(argv) {
  const result = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--out-dir") {
      result.outDir = argv[i + 1]
      i += 1
      continue
    }
    if (arg === "--version") {
      result.version = argv[i + 1]
      i += 1
      continue
    }
    if (arg === "--local-links") {
      result.localLinks = true
    }
  }
  return result
}

function resolveVersion(explicitVersion) {
  if (explicitVersion) return explicitVersion

  throw new Error(
    "Starter packaging requires the separately released @voyant-travel/cli version. Pass --version explicitly.",
  )
}
