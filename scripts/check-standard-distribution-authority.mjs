import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { STANDARD_OPERATOR_DISTRIBUTION } from "../packages/framework/src/operator-distribution.ts"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const retiredProjectionFiles = [
  "packages/framework/src/manifest.ts",
  "packages/framework/src/manifest.test.ts",
  "packages/framework/src/profile-types.ts",
]

for (const relativePath of retiredProjectionFiles) {
  assert.equal(
    existsSync(path.join(repoRoot, relativePath)),
    false,
    `${relativePath} must stay deleted`,
  )
}

const distributionSource = await readFile(
  path.join(repoRoot, "packages/framework/src/operator-distribution.ts"),
  "utf8",
)
for (const retiredToken of [
  "legacyRuntime",
  "STANDARD_OPERATOR_LEGACY_RUNTIME_MANIFEST",
  "STANDARD_OPERATOR_LEGACY_EXTENSION_OWNERSHIP",
]) {
  assert.doesNotMatch(
    distributionSource,
    new RegExp(retiredToken),
    `operator-distribution.ts must not restore legacy runtime projection ${retiredToken}`,
  )
}

const frameworkIndex = await readFile(
  path.join(repoRoot, "packages/framework/src/index.ts"),
  "utf8",
)
for (const retiredExport of [
  "FRAMEWORK_RUNTIME_MANIFEST",
  "FRAMEWORK_EXTENSION_OWNERSHIP",
  "FRAMEWORK_CAPABILITY_GRAPH",
  "subsetStandardManifest",
  "ownedExtensionsForExcludedModules",
]) {
  assert.doesNotMatch(
    frameworkIndex,
    new RegExp(retiredExport),
    `framework index must not restore retired projection ${retiredExport}`,
  )
}

const deploymentGraphSource = await readFile(
  path.join(repoRoot, "packages/framework/src/deployment-graph.ts"),
  "utf8",
)
assert.doesNotMatch(
  deploymentGraphSource,
  /generateFramework(?:Module|Extension|Plugin)Manifests/,
  "deployment graph must load package-owned manifests instead of synthesizing framework manifests",
)

for (const selection of [
  ...STANDARD_OPERATOR_DISTRIBUTION.modules,
  ...STANDARD_OPERATOR_DISTRIBUTION.extensions,
]) {
  assert.equal(typeof selection, "string", "standard distribution selections must be package refs")
  const { packageName, unitPath } = splitSelection(selection)
  const packageRoot = path.join(repoRoot, "packages", packageName.replace("@voyant-travel/", ""))
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"))
  assert.equal(
    packageJson.voyant?.manifest,
    "./voyant",
    `${packageName} must declare voyant.manifest as ./voyant`,
  )
  assert.ok(packageJson.exports?.["./voyant"], `${packageName} must export ./voyant`)

  const manifestSource = await readFile(path.join(packageRoot, "src", "voyant.ts"), "utf8")
  const graphId = unitPath ? `${packageName}#${unitPath.replaceAll("/", ".")}` : packageName
  assert.match(
    manifestSource,
    new RegExp(`id:\\s*["']${escapeRegExp(graphId)}["']`),
    `${selection} must be declared by ${packageName}/voyant`,
  )
}

console.log("standard distribution authority: OK")

function splitSelection(selection) {
  const parts = selection.split("/")
  const packageName = parts.slice(0, 2).join("/")
  return { packageName, unitPath: parts.slice(2).join("/") }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
