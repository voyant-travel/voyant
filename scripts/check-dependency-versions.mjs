#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const dependencySections = ["dependencies", "devDependencies", "optionalDependencies"]

const catalogDependencies = readDefaultCatalogDependencies()
const packageJsonFiles = execFileSync(
  "rg",
  [
    "--files",
    "-g",
    "package.json",
    "-g",
    "!node_modules/**",
    "-g",
    "!dist/**",
    "-g",
    "!build/**",
    "-g",
    "!.claude/worktrees/**",
  ],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean)

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
}

if (violations.length > 0) {
  console.error(
    [
      "Dependency version policy violations found.",
      "Use pnpm workspace catalog entries for shared concrete dependencies.",
      "Peer dependency ranges are intentionally checked separately from this policy.",
      "",
      ...violations,
    ].join("\n"),
  )
  process.exit(1)
}

console.log(
  `Dependency version policy passed for ${catalogDependencies.size} catalog dependencies across ${packageJsonFiles.length} package manifests.`,
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
