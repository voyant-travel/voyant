import { execFileSync } from "node:child_process"
import {
  cpSync,
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
const cliPackageJsonPath = join(repoRoot, "packages", "cli", "package.json")
const args = parseArgs(process.argv.slice(2))
const version = resolveVersion(args.version)
const outDir = resolve(repoRoot, args.outDir ?? ".release/starters")
const starters = ["operator"]
const includedAppsByStarter = new Map([["operator", ["flights-demo-api"]]])
const catalogVersions = readCatalogVersions()
const workspaceVersions = readWorkspaceVersions()
const skipNames = new Set([
  "node_modules",
  ".git",
  ".github",
  ".turbo",
  ".tanstack",
  "dist",
  ".wrangler",
  ".next",
  ".vite",
  "coverage",
  ".cache",
  ".env",
  ".env.local",
  ".dev.vars",
  ".dev.vars.local",
  ".DS_Store",
])

mkdirSync(outDir, { recursive: true })

for (const starter of starters) {
  const source = join(repoRoot, "starters", starter)
  if (!existsSync(source)) {
    throw new Error(`Missing starter: ${source}`)
  }

  const stagingRoot = mkdtempSync(join(tmpdir(), `voyant-starter-${starter}-`))
  const stagingTemplate = join(stagingRoot, "template")

  try {
    cpSync(source, stagingTemplate, {
      recursive: true,
      force: true,
      filter: (src) => {
        const rel = src.slice(source.length).replace(/^[\\/]+/, "")
        if (!rel) return true
        const first = rel.split(/[\\/]/)[0]
        return !skipNames.has(first)
      },
    })

    stageIncludedApps(starter, stagingTemplate)

    const archivePath = join(outDir, assetFileName(starter, version))
    execFileSync("tar", ["-czf", archivePath, "-C", stagingTemplate, "."], {
      stdio: "inherit",
    })
    console.log(`Packaged ${starter}: ${archivePath}`)
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true })
  }
}

function stageIncludedApps(starter, stagingTemplate) {
  const includedApps = includedAppsByStarter.get(starter) ?? []
  if (includedApps.length === 0) return

  const appsDir = join(stagingTemplate, "apps")
  mkdirSync(appsDir, { recursive: true })

  for (const app of includedApps) {
    const source = join(repoRoot, "apps", app)
    if (!existsSync(source)) {
      throw new Error(`Missing included app for ${starter}: ${source}`)
    }
    const appDest = join(appsDir, app)
    cpSync(source, appDest, {
      recursive: true,
      force: true,
      filter: (src) => {
        const rel = src.slice(source.length).replace(/^[\\/]+/, "")
        if (!rel) return true
        const first = rel.split(/[\\/]/)[0]
        return !skipNames.has(first)
      },
    })
    stageStandaloneApp(appDest)
  }
}

function stageStandaloneApp(appDir) {
  const packageJsonPath = join(appDir, "package.json")
  const packageJson = readJson(packageJsonPath)
  rewriteDependencyGroup(packageJson.dependencies)
  rewriteDependencyGroup(packageJson.devDependencies)
  rewriteDependencyGroup(packageJson.peerDependencies)
  rewriteDependencyGroup(packageJson.optionalDependencies)

  if (packageJson.devDependencies) {
    delete packageJson.devDependencies["@voyant-travel/voyant-typescript-config"]
    if (Object.keys(packageJson.devDependencies).length === 0) {
      delete packageJson.devDependencies
    }
  }
  writeJson(packageJsonPath, packageJson)

  const tsconfigPath = join(appDir, "tsconfig.json")
  if (existsSync(tsconfigPath)) {
    const baseTsconfig = readJson(join(repoRoot, "packages", "typescript-config", "base.json"))
    const appTsconfig = readJson(tsconfigPath)
    delete appTsconfig.extends
    appTsconfig.compilerOptions = {
      ...(baseTsconfig.compilerOptions ?? {}),
      ...(appTsconfig.compilerOptions ?? {}),
    }
    writeJson(tsconfigPath, appTsconfig)
  }
}

function rewriteDependencyGroup(group) {
  if (!group) return
  for (const [name, spec] of Object.entries(group)) {
    if (typeof spec !== "string") continue
    if (spec === "catalog:") {
      const catalogSpec = catalogVersions.get(name)
      if (!catalogSpec) {
        throw new Error(`Missing catalog entry for packaged starter dependency: ${name}`)
      }
      group[name] = catalogSpec
      continue
    }
    if (spec.startsWith("workspace:")) {
      const packageVersion = workspaceVersions.get(name)
      if (!packageVersion) {
        throw new Error(`Missing workspace package for packaged starter dependency: ${name}`)
      }
      group[name] = workspaceRange(spec, packageVersion)
    }
  }
}

function workspaceRange(spec, packageVersion) {
  const suffix = spec.slice("workspace:".length)
  if (suffix === "*" || suffix === "") return packageVersion
  if (suffix === "^" || suffix === "~") return `${suffix}${packageVersion}`
  return suffix
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
    }
  }
  return result
}

function readVersion(pkgPath) {
  const raw = readFileSync(pkgPath, "utf8")
  const pkg = JSON.parse(raw)
  return pkg.version
}

function resolveVersion(explicitVersion) {
  if (explicitVersion) {
    return explicitVersion
  }

  if (existsSync(cliPackageJsonPath)) {
    return readVersion(cliPackageJsonPath)
  }

  throw new Error(
    "Starter packaging no longer has an implicit repo-wide package version. Pass --version explicitly.",
  )
}
