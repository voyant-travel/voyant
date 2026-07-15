import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, test } from "node:test"

import { packedFileExportsName } from "../lib/packed-exports.mjs"
import { collectPackedManifestProtocolDependencies } from "../lib/packed-manifest.mjs"

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("follows star barrels to exported declarations", () => {
  const root = createFixture({
    "dist/index.js": 'export * from "./workflow.js"\n',
    "dist/workflow.js": "export function defineWorkflow() {}\n",
  })

  assert.equal(packedFileExportsName(root, "dist/index.js", "defineWorkflow"), true)
})

test("rejects private identifier occurrences behind star barrels", () => {
  const root = createFixture({
    "dist/index.js": 'export * from "./workflow.js"\n',
    "dist/workflow.js": "function defineWorkflow() {}\n",
  })

  assert.equal(packedFileExportsName(root, "dist/index.js", "defineWorkflow"), false)
})

test("maps declaration barrels from .js specifiers to .d.ts files", () => {
  const root = createFixture({
    "dist/index.d.ts": 'export * from "./workflow.js"\n',
    "dist/workflow.d.ts": "export declare function defineWorkflow(): void\n",
  })

  assert.equal(packedFileExportsName(root, "dist/index.d.ts", "defineWorkflow"), true)
})

test("uses the exported alias rather than the local name", () => {
  const root = createFixture({
    "dist/index.js": "const internal = 1\nexport { internal as defineWorkflow }\n",
  })

  assert.equal(packedFileExportsName(root, "dist/index.js", "defineWorkflow"), true)
  assert.equal(packedFileExportsName(root, "dist/index.js", "internal"), false)
})

test("rejects package-manager protocols from packed manifest dependencies", () => {
  const manifest = {
    dependencies: { zod: "catalog:" },
    peerDependencies: { react: "^19.0.0" },
    optionalDependencies: { internal: "workspace:^" },
    devDependencies: { typescript: "catalog:build" },
  }

  assert.deepEqual(collectPackedManifestProtocolDependencies(manifest), [
    "dependencies.zod=catalog:",
    "optionalDependencies.internal=workspace:^",
    "devDependencies.typescript=catalog:build",
  ])
})

test("accepts external-consumer dependency ranges in packed manifests", () => {
  const manifest = {
    dependencies: { zod: "^4.4.3" },
    peerDependencies: { react: ">=18" },
    optionalDependencies: { sharp: "npm:@img/sharp@^0.34.0" },
  }

  assert.deepEqual(collectPackedManifestProtocolDependencies(manifest), [])
})

function createFixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), "voyant-packed-exports-"))
  temporaryDirectories.push(root)
  for (const [filePath, source] of Object.entries(files)) {
    const destination = path.join(root, filePath)
    mkdirSync(path.dirname(destination), { recursive: true })
    writeFileSync(destination, source)
  }
  return root
}
