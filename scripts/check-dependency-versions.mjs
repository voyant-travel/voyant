#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const dependencySections = ["dependencies", "devDependencies", "optionalDependencies"]
const firstPartyPeerDependencyRanges = new Map([["lucide-react", "^0.475.0 || ^1.0.0"]])

const catalogDependencies = readDefaultCatalogDependencies()
const packageJsonFiles = listPackageJsonFiles(".")

const violations = []

for (const packageJsonFile of packageJsonFiles) {
  const packageJson = JSON.parse(readFileSync(packageJsonFile, "utf8"))

  for (const section of dependencySections) {
    const dependencies = packageJson[section]

    if (!dependencies) {
      continue
    }

    for (const dependencyName of Object.keys(dependencies)) {
      if (!catalogDependencies.has(dependencyName)) {
        continue
      }

      const requestedVersion = dependencies[dependencyName]

      if (requestedVersion !== "catalog:") {
        violations.push(
          `${packageJsonFile}: ${section}.${dependencyName} must use catalog: (found ${requestedVersion})`,
        )
      }
    }
  }

  if (packageJson.name?.startsWith("@voyant-travel/")) {
    for (const [dependencyName, expectedRange] of firstPartyPeerDependencyRanges) {
      const requestedRange = packageJson.peerDependencies?.[dependencyName]
      if (requestedRange && requestedRange !== expectedRange) {
        violations.push(
          `${packageJsonFile}: peerDependencies.${dependencyName} must use ${expectedRange} (found ${requestedRange})`,
        )
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    [
      "Dependency version policy violations found.",
      "Use pnpm workspace catalog entries for shared concrete dependencies and canonical first-party peer ranges.",
      "",
      ...violations,
    ].join("\n"),
  )
  process.exit(1)
}

console.log(
  `Dependency version policy passed for ${catalogDependencies.size} catalog dependencies and ${firstPartyPeerDependencyRanges.size} first-party peer policies across ${packageJsonFiles.length} package manifests.`,
)

function readDefaultCatalogDependencies() {
  const workspaceYaml = readFileSync("pnpm-workspace.yaml", "utf8")
  const dependencies = new Set()
  let inDefaultCatalog = false

  for (const line of workspaceYaml.split("\n")) {
    if (line === "catalog:") {
      inDefaultCatalog = true
      continue
    }

    if (inDefaultCatalog && line.length > 0 && !line.startsWith(" ")) {
      break
    }

    if (!inDefaultCatalog) {
      continue
    }

    const catalogEntry = line.match(/^ {2}(?:"([^"]+)"|'([^']+)'|([^:#]+)):\s+.+$/)

    if (!catalogEntry) {
      continue
    }

    dependencies.add((catalogEntry[1] ?? catalogEntry[2] ?? catalogEntry[3]).trim())
  }

  if (dependencies.size === 0) {
    console.error("No default catalog dependencies found in pnpm-workspace.yaml.")
    process.exit(1)
  }

  return dependencies
}

function listPackageJsonFiles(rootDir) {
  const packageJsonFiles = []
  const ignoredDirectories = new Set([".git", ".turbo", "build", "dist", "node_modules"])

  walk(rootDir)

  return packageJsonFiles.sort()

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      const relativePath = path.relative(rootDir, fullPath).split(path.sep).join("/")

      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name) || relativePath.startsWith(".claude/worktrees/")) {
          continue
        }

        walk(fullPath)
        continue
      }

      if (entry.isFile() && entry.name === "package.json") {
        packageJsonFiles.push(relativePath)
      }
    }
  }
}
