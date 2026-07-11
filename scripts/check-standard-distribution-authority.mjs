import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { STANDARD_OPERATOR_DISTRIBUTION } from "../packages/framework/src/operator-distribution.ts"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const compatibilityFiles = [
  "packages/framework/src/manifest.ts",
  "packages/framework/src/profile-types.ts",
]

for (const relativePath of compatibilityFiles) {
  const source = await readFile(path.join(repoRoot, relativePath), "utf8")
  const executableSource = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["']\s*$/gm, "")
  assert.doesNotMatch(
    executableSource,
    /["']@voyant-travel\/(?:accommodations|action-ledger|availability|bookings|catalog|catalog-authoring|charters|commerce|cruises|db|distribution|finance|flights|identity|inventory|legal|mice|notifications|operations|operator-settings|public-document-delivery|quotes|realtime|relationships|storage|storefront|trips|workflow-runs)(?:[/"'])/,
    `${relativePath} must derive first-party selections from operator-distribution.ts`,
  )
}

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
