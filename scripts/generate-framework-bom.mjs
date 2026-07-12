/**
 * Keeps the @voyant-travel/framework BOM in sync with the runtime-module set.
 * RFC: docs/architecture/consolidated-deployments-rfc.md (Workstream A).
 *
 * The BOM pins exactly the packages selected by the authored standard Operator
 * distribution, plus workspace packages referenced by their manifests, as
 * `workspace:*` deps — pnpm publishes those as the EXACT current version, so the
 * published BOM is a deterministic, tested set. A deployment depends on the one
 * BOM version; `voyant upgrade` bumps it. Only the BOM + actually-changed
 * packages republish, so there's no per-package email spam.
 *
 * This generator rewrites only the framework package's publish dependencies.
 * The authored distribution and package manifests remain resolver authority;
 * generated dependency metadata is output-only. `--emit` writes; default mode
 * fails on publish dependency drift.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const PKG = join(ROOT, "packages/framework/package.json")
const DISTRIBUTION = join(ROOT, "packages/framework/src/operator-distribution.ts")
const EMIT = process.argv.includes("--emit")

const standardPackages = [
  ...readFileSync(DISTRIBUTION, "utf8").matchAll(/resolve:\s*"(@voyant-travel\/[^"/]+)/g),
].map((match) => match[1])
const workspacePackages = readWorkspacePackages()
const manifestReferencePackages = manifestPackageClosure(standardPackages, workspacePackages)
const bomPackages = [...new Set([...standardPackages, ...manifestReferencePackages])].sort()
const frameworkRuntimeEntryDeps = {
  "@voyant-travel/auth": "workspace:*",
  "@voyant-travel/cloud-sdk": "^0.11.0",
  "@voyant-travel/connect-sdk": "0.9.1",
  "@voyant-travel/core": "workspace:*",
  "@voyant-travel/cruises": "workspace:*",
  "@voyant-travel/db": "workspace:*",
  "@voyant-travel/framework-migrations": "workspace:*",
  "@voyant-travel/mcp": "workspace:*",
  "@voyant-travel/plugin-voyant-connect": "^0.3.2",
  "@voyant-travel/runtime": "workspace:*",
  "@voyant-travel/storage": "workspace:*",
  "@voyant-travel/tools": "workspace:*",
  "@voyant-travel/types": "workspace:*",
  "@voyant-travel/utils": "workspace:*",
  "@voyant-travel/workflows": "workspace:*",
  "@voyant-travel/workflows-orchestrator": "workspace:*",
  "drizzle-orm": "catalog:",
  pg: "^8.22.0",
  typescript: "catalog:",
}

// BOM dependencies include every standard product selection owner, not only
// packages with server runtime membership. Otherwise a minimal project cannot
// resolve manifest-only/admin-only selections without repeating dependencies.
const deps = {}
for (const name of bomPackages) deps[name] = "workspace:*"
for (const name of Object.keys(frameworkRuntimeEntryDeps).sort()) {
  deps[name] = frameworkRuntimeEntryDeps[name]
}

const pkg = JSON.parse(readFileSync(PKG, "utf-8"))
const nextPkg = `${JSON.stringify({ ...pkg, dependencies: deps }, null, 2)}\n`

const violations = []
if (EMIT) {
  writeFileSync(PKG, nextPkg)
  console.log(`generate-framework-bom: emitted ${bomPackages.length} standard product deps`)
} else {
  if (readFileSync(PKG, "utf-8") !== nextPkg) {
    violations.push("packages/framework/package.json dependencies are stale")
  }
  if (violations.length) {
    console.error("Framework BOM drift — run `node scripts/generate-framework-bom.mjs --emit`:")
    for (const v of violations) console.error(`  - ${v}`)
    process.exit(1)
  }
  console.log(`check-framework-bom: OK (${bomPackages.length} standard product deps)`)
}

function readWorkspacePackages() {
  const packages = new Map()
  for (const root of [join(ROOT, "packages"), join(ROOT, "packages", "plugins")]) {
    for (const entry of readdirSync(root)) {
      const directory = join(root, entry)
      if (!statSync(directory).isDirectory()) continue
      const packageJson = join(directory, "package.json")
      if (!existsSync(packageJson)) continue
      const name = JSON.parse(readFileSync(packageJson, "utf8")).name
      if (name) packages.set(name, directory)
    }
  }
  return packages
}

function manifestPackageClosure(seedPackages, workspacePackages) {
  const visited = new Set()
  const discovered = new Set()
  const queue = [...new Set(seedPackages)]
  while (queue.length > 0) {
    const packageName = queue.shift()
    if (visited.has(packageName)) continue
    visited.add(packageName)
    const directory = workspacePackages.get(packageName)
    if (!directory) continue
    for (const manifestPath of findManifestFiles(directory)) {
      const source = readFileSync(join(directory, manifestPath), "utf8")
      for (const match of source.matchAll(/["'](@voyant-travel\/[^"'/]+)(?:\/[^"']*)?["']/g)) {
        const referencedPackage = match[1]
        if (!workspacePackages.has(referencedPackage)) continue
        discovered.add(referencedPackage)
        if (!visited.has(referencedPackage)) queue.push(referencedPackage)
      }
    }
  }
  return [...discovered]
}

function findManifestFiles(directory, relative = "") {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "coverage", ".turbo"].includes(entry.name)) continue
    const nextRelative = join(relative, entry.name)
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...findManifestFiles(path, nextRelative))
    else if (/^(?:voyant|graph-manifest)\.ts$/.test(entry.name)) files.push(nextRelative)
  }
  return files
}
