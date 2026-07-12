import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const TARGET_LABELLED_RUNTIME_NAME =
  /\b[A-Za-z0-9_$]*StandardNode[A-Za-z0-9_$]*\b|\bstandardNode[A-Za-z0-9_$]*\b/

export function findDomainRuntimeNamingViolations(root) {
  const packagesRoot = path.join(root, "packages")
  if (!existsSync(packagesRoot)) return []

  const violations = []
  for (const packageRoot of packageRoots(packagesRoot)) {
    const manifestPath = path.join(packageRoot, "package.json")
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    if (!manifest.name?.startsWith("@voyant-travel/") || manifest.voyant?.kind !== "module") {
      continue
    }

    const exportNames = [
      ...Object.keys(manifest.exports ?? {}),
      ...Object.keys(manifest.publishConfig?.exports ?? {}),
    ]
    if (exportNames.some((exportName) => exportName.includes("standard-node"))) {
      violations.push(`${manifest.name} must not export a target-labelled /standard-node API`)
    }

    const sourceRoot = path.join(packageRoot, "src")
    for (const sourcePath of sourceFiles(sourceRoot)) {
      const relativePath = path.relative(root, sourcePath)
      if (path.basename(sourcePath).includes("standard-node")) {
        violations.push(`${relativePath} must use a runtime-neutral filename`)
      }
      if (TARGET_LABELLED_RUNTIME_NAME.test(readFileSync(sourcePath, "utf8"))) {
        violations.push(`${relativePath} must not declare a StandardNode runtime API name`)
      }
    }
  }
  return violations
}

function packageRoots(packagesRoot) {
  const roots = []
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const packageRoot = path.join(packagesRoot, entry.name)
    if (existsSync(path.join(packageRoot, "package.json"))) {
      roots.push(packageRoot)
      continue
    }
    for (const nested of readdirSync(packageRoot, { withFileTypes: true })) {
      if (!nested.isDirectory()) continue
      const nestedRoot = path.join(packageRoot, nested.name)
      if (existsSync(path.join(nestedRoot, "package.json"))) roots.push(nestedRoot)
    }
  }
  return roots
}

function sourceFiles(directory) {
  if (!existsSync(directory)) return []
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(entryPath))
    else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) files.push(entryPath)
  }
  return files
}
