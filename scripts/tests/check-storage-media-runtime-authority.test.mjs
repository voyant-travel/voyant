import { strict as assert } from "node:assert"
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "../..")
const checker = path.join(root, "scripts/check-storage-media-runtime-authority.mjs")
const fixturePaths = [
  "packages/storage/src/runtime-contributor.ts",
  "packages/storage/src/runtime.ts",
  "packages/storage/package.json",
  "packages/inventory/src/runtime-contributor.ts",
  "packages/inventory/src/brochure-runtime.ts",
  "packages/inventory/src/graph-runtime.ts",
  "packages/inventory/src/voyant.ts",
  "packages/inventory/package.json",
  "starters/operator/src/api/runtime/operator-runtime-adapter.ts",
  "starters/operator/src/api/runtime/deployment-resources.ts",
  "scripts/fixtures/storage-media-runtime-policy.json",
]

function createFixture() {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "voyant-storage-media-authority-"))
  for (const relativePath of fixturePaths) {
    const destination = path.join(fixtureRoot, relativePath)
    mkdirSync(path.dirname(destination), { recursive: true })
    cpSync(path.join(root, relativePath), destination)
  }
  return fixtureRoot
}

function runChecker(fixtureRoot) {
  return execFileSync(process.execPath, [checker, "--root", fixtureRoot], {
    encoding: "utf8",
    stdio: "pipe",
  })
}

test("accepts package-owned Storage and brochure runtimes", () => {
  assert.match(runChecker(createFixture()), /OK/)
})

test("rejects a Storage contributor that returns to a starter capability", () => {
  const fixtureRoot = createFixture()
  const contributorPath = path.join(fixtureRoot, "packages/storage/src/runtime-contributor.ts")
  writeFileSync(
    contributorPath,
    readFileSync(contributorPath, "utf8").replace(
      "createStorageRuntime(host.primitives)",
      "host.capabilities.loadStorageMediaRuntime()",
    ),
  )
  assert.throws(() => runChecker(fixtureRoot), /Storage contributor/)
})

test("rejects an Inventory contributor that returns to a starter capability", () => {
  const fixtureRoot = createFixture()
  const contributorPath = path.join(fixtureRoot, "packages/inventory/src/runtime-contributor.ts")
  writeFileSync(
    contributorPath,
    readFileSync(contributorPath, "utf8").replace(
      "createInventoryRuntime(host.primitives)",
      "host.capabilities.loadInventoryRuntime()",
    ),
  )
  assert.throws(() => runChecker(fixtureRoot), /Inventory/)
})

test("rejects restored Operator storage compatibility facades", () => {
  for (const facade of [
    "starters/operator/src/api/runtime/media-runtime.ts",
    "starters/operator/src/api/lib/storage.ts",
  ]) {
    const fixtureRoot = createFixture()
    const facadePath = path.join(fixtureRoot, facade)
    mkdirSync(path.dirname(facadePath), { recursive: true })
    writeFileSync(facadePath, "export const compatibilityFacade = true\n")
    assert.throws(() => runChecker(fixtureRoot), new RegExp(`${facade} must stay deleted`))
  }
})
