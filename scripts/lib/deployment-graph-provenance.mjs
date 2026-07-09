import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { parse } from "yaml"

const dependencySections = ["dependencies", "optionalDependencies", "devDependencies"]
const ignoredWorkspaceDirs = new Set([".git", ".turbo", "build", "dist", "node_modules"])

export function readPnpmLockfilePackageRecords(options) {
  const repoRoot = options.repoRoot ?? process.cwd()
  const lockfilePath = options.lockfilePath ?? path.join(repoRoot, "pnpm-lock.yaml")
  return packageRecordsFromPnpmLockfile(readFileSync(lockfilePath, "utf8"), {
    packageNames: options.packageNames,
    importerPaths: options.importerPaths,
    workspacePackageVersions:
      options.workspacePackageVersions ?? readWorkspacePackageVersions(repoRoot),
  })
}

export function packageRecordsFromPnpmLockfile(lockfileText, options) {
  const lockfile = parse(lockfileText)
  const dependencies = indexImporterDependencies(lockfile?.importers ?? {}, options.importerPaths)
  const workspacePackageVersions = new Map(
    Object.entries(options.workspacePackageVersions ?? {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  )

  return [...new Set(options.packageNames)]
    .sort((left, right) => left.localeCompare(right))
    .map((packageName) =>
      packageRecordForPackage(packageName, {
        lockfile,
        dependencies: dependencies.get(packageName) ?? [],
        workspacePackageVersions,
      }),
    )
}

export function readWorkspacePackageVersions(repoRoot) {
  const versions = {}
  for (const packageJsonPath of listPackageJsonFiles(repoRoot)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    if (typeof packageJson.name !== "string" || typeof packageJson.version !== "string") continue
    versions[packageJson.name] = packageJson.version
  }
  return versions
}

function packageRecordForPackage(packageName, context) {
  const dependency = chooseDependency(
    packageName,
    context.dependencies,
    context.workspacePackageVersions,
  )
  if (!dependency) {
    return unknownPackageRecord(packageName, context.workspacePackageVersions.get(packageName))
  }

  if (isWorkspaceDependency(dependency)) {
    return {
      packageName,
      ...versionField(context.workspacePackageVersions.get(packageName)),
      source: {
        kind: "workspace",
        reference: dependency.version,
      },
    }
  }

  if (dependency.version.startsWith("file:")) {
    return {
      packageName,
      source: { kind: "file", reference: dependency.version },
    }
  }

  if (isGitReference(dependency.version)) {
    return {
      packageName,
      source: { kind: "git", reference: dependency.version },
    }
  }

  const version = basePnpmVersion(dependency.version)
  const integrity = context.lockfile?.packages?.[`${packageName}@${version}`]?.resolution?.integrity
  return {
    packageName,
    ...versionField(version),
    source: {
      kind: "registry",
      reference: `pnpm-lock:${packageName}@${dependency.version}`,
      ...(typeof integrity === "string" ? { integrity } : {}),
    },
  }
}

function chooseDependency(packageName, dependencies, workspacePackageVersions) {
  if (workspacePackageVersions.has(packageName)) {
    return dependencies.find(isWorkspaceDependency)
  }
  return [...dependencies].sort(compareDependencies)[0]
}

function unknownPackageRecord(packageName, version) {
  return {
    packageName,
    ...versionField(version),
    source: { kind: "unknown" },
  }
}

function versionField(version) {
  return typeof version === "string" && version.length > 0 ? { version } : {}
}

function indexImporterDependencies(importers, importerPaths) {
  const selectedImporters = importerPaths ? new Set(importerPaths) : undefined
  const dependencies = new Map()

  for (const [importerPath, importer] of Object.entries(importers)) {
    if (selectedImporters && !selectedImporters.has(importerPath)) continue

    for (const section of dependencySections) {
      for (const [packageName, value] of Object.entries(importer?.[section] ?? {})) {
        if (!value || typeof value !== "object" || typeof value.version !== "string") continue
        const entries = dependencies.get(packageName) ?? []
        entries.push({
          importerPath,
          section,
          specifier: typeof value.specifier === "string" ? value.specifier : "",
          version: value.version,
        })
        dependencies.set(packageName, entries)
      }
    }
  }

  return dependencies
}

function compareDependencies(left, right) {
  return (
    dependencyRank(left) - dependencyRank(right) ||
    left.importerPath.localeCompare(right.importerPath) ||
    left.section.localeCompare(right.section) ||
    left.version.localeCompare(right.version)
  )
}

function dependencyRank(entry) {
  if (isWorkspaceDependency(entry)) return 0
  if (entry.version.startsWith("file:")) return 1
  if (isGitReference(entry.version)) return 2
  return 3
}

function isWorkspaceDependency(entry) {
  return entry.version.startsWith("link:") || entry.specifier.startsWith("workspace:")
}

function isGitReference(value) {
  return value.startsWith("git+") || value.startsWith("github:") || value.includes(".git#")
}

function basePnpmVersion(value) {
  return value.split("(")[0] ?? value
}

function listPackageJsonFiles(rootDir) {
  const files = []
  walk(rootDir)
  return files.sort((left, right) => left.localeCompare(right))

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      const relativePath = path.relative(rootDir, fullPath).split(path.sep).join("/")

      if (entry.isDirectory()) {
        if (ignoredWorkspaceDirs.has(entry.name) || relativePath.startsWith(".claude/worktrees/")) {
          continue
        }
        walk(fullPath)
        continue
      }

      if (entry.isFile() && entry.name === "package.json" && existsSync(fullPath)) {
        files.push(fullPath)
      }
    }
  }
}
