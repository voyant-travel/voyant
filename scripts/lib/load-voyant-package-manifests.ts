import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import type {
  VoyantGraphPackageRecord,
  VoyantGraphUnitManifest,
} from "../../packages/framework/src/deployment-graph.ts"

export async function loadVoyantPackageManifests(
  record: VoyantGraphPackageRecord,
  options: { projectRoot: string; repoRoot: string },
): Promise<readonly VoyantGraphUnitManifest[]> {
  const manifest = record.metadata?.manifest
  if (!manifest?.startsWith("./")) {
    throw new Error(`${record.packageName} package metadata must point at a ./ manifest export`)
  }

  const specifier = `${record.packageName}/${manifest.slice(2)}`
  const loaded = (await import(resolveManifestImport(record, specifier, options))) as Record<
    string,
    unknown
  >
  const manifests = new Map<string, VoyantGraphUnitManifest>()
  for (const value of Object.values(loaded)) {
    if (!isVoyantGraphUnitManifest(value)) continue
    manifests.set(value.id, value)
  }
  return [...manifests.values()].sort((left, right) => left.id.localeCompare(right.id))
}

function resolveManifestImport(
  record: VoyantGraphPackageRecord,
  specifier: string,
  options: { projectRoot: string; repoRoot: string },
): string {
  const packageDirectory =
    resolveWorkspaceDirectory(record, options) ??
    resolveInstalledPackageDirectory(record.packageName, options)
  if (packageDirectory) {
    const packageJson = JSON.parse(
      readFileSync(path.join(packageDirectory, "package.json"), "utf8"),
    ) as Record<string, unknown>
    const exports = packageJson.exports as Record<string, unknown> | undefined
    const targets = packageExportTargets(exports?.[record.metadata?.manifest ?? ""]) ?? []
    if (targets.length === 0)
      throw new Error(`${record.packageName} does not export ${record.metadata?.manifest}`)
    let invalidTarget: Error | undefined
    for (const target of targets) {
      try {
        return pathToFileURL(
          resolvePackageExportTarget(packageDirectory, target, record.packageName),
        ).href
      } catch (error) {
        invalidTarget = error instanceof Error ? error : new Error(String(error))
      }
    }
    throw invalidTarget ?? new Error(`${record.packageName} has no valid manifest export target`)
  }

  throw new Error(`${specifier} is not installed under ${options.projectRoot}`)
}

function resolveInstalledPackageDirectory(
  packageName: string,
  options: { projectRoot: string; repoRoot: string },
): string | undefined {
  for (const root of [...new Set([options.projectRoot, options.repoRoot])]) {
    const directory = path.join(root, "node_modules", packageName)
    if (existsSync(path.join(directory, "package.json"))) return directory
  }
  return undefined
}

function resolveWorkspaceDirectory(
  record: VoyantGraphPackageRecord,
  options: { projectRoot: string; repoRoot: string },
): string | undefined {
  if (record.source.kind !== "workspace") return undefined
  const reference = record.source.reference
  if (reference?.startsWith("link:")) {
    const linked = path.resolve(options.projectRoot, reference.slice("link:".length))
    if (existsSync(path.join(linked, "package.json"))) return linked
  }
  return findWorkspacePackage(path.join(options.repoRoot, "packages"), record.packageName)
}

function findWorkspacePackage(directory: string, packageName: string): string | undefined {
  if (!existsSync(directory)) return undefined
  const packageJsonPath = path.join(directory, "package.json")
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string }
    return packageJson.name === packageName ? directory : undefined
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === "dist") continue
    const found = findWorkspacePackage(path.join(directory, entry.name), packageName)
    if (found) return found
  }
  return undefined
}

function packageExportTargets(value: unknown): string[] | undefined {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) {
    const targets: string[] = []
    for (const candidate of value) {
      targets.push(...(packageExportTargets(candidate) ?? []))
    }
    return targets
  }
  if (value === null) return []
  if (typeof value !== "object") return undefined
  for (const [condition, candidate] of Object.entries(value)) {
    if (condition !== "node" && condition !== "import" && condition !== "default") continue
    const targets = packageExportTargets(candidate)
    if (targets !== undefined) return targets
  }
  return undefined
}

function resolvePackageExportTarget(
  packageDirectory: string,
  target: string,
  packageName: string,
): string {
  if (!target.startsWith("./")) {
    throw new Error(`${packageName} manifest export target must start with ./`)
  }
  const packageRoot = path.resolve(packageDirectory)
  const resolved = path.resolve(packageRoot, target)
  const relative = path.relative(packageRoot, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${packageName} manifest export target must stay inside the package`)
  }
  return resolved
}

function isVoyantGraphUnitManifest(value: unknown): value is VoyantGraphUnitManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === "string" &&
    (candidate.schemaVersion === "voyant.module.v1" ||
      candidate.schemaVersion === "voyant.extension.v1" ||
      candidate.schemaVersion === "voyant.plugin.v1" ||
      candidate.schemaVersion === "voyant.adapter.v1" ||
      candidate.schemaVersion === "voyant.provider.v1")
  )
}
