import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, test } from "node:test"

import { packedFileExportsName } from "../lib/packed-exports.mjs"
import { inspectPackedVoyantManifestRuntimeExports } from "../verify-package-tarballs.mjs"

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

test("reports package-owned runtime entries missing from packed exports", async () => {
  const manifest = packedManifest({
    "./runtime-contributor": "./dist/runtime-contributor.js",
    "./voyant": "./dist/voyant.js",
  })
  const root = createPackedPackageFixture(manifest, {
    "dist/runtime-contributor.js": "export function createFinanceRuntimePortContribution() {}\n",
    "dist/voyant.js": `export const financeVoyantModule = ${JSON.stringify(financeVoyantModule)}\n`,
  })

  const problems = await inspectPackedVoyantManifestRuntimeExports(root, root, manifest)

  assert.deepEqual(problems, [
    "runtime entry @voyant-travel/finance/setup/vouchers cannot be imported (ERR_PACKAGE_PATH_NOT_EXPORTED)",
  ])
})

test("accepts package runtime entries with resolvable named exports", async () => {
  const manifest = packedManifest({
    "./runtime-contributor": {
      types: "./dist/runtime-contributor.d.ts",
      import: "./dist/runtime-contributor.js",
    },
    "./setup/*": {
      types: "./dist/setup/*.d.ts",
      import: "./dist/setup/*.js",
    },
    "./voyant": "./dist/voyant.js",
  })
  const packedVoyantModule = {
    ...financeVoyantModule,
    subscribers: [
      {
        id: "@voyant-travel/finance#subscriber.local",
        runtime: { entry: "./setup/vouchers", export: "runVoucherSetupMigration" },
      },
    ],
  }
  const root = createPackedPackageFixture(manifest, {
    "dist/runtime-contributor.js": "export function createFinanceRuntimePortContribution() {}\n",
    "dist/setup/vouchers.js": "export function runVoucherSetupMigration() {}\n",
    "dist/voyant.js": `export const financeVoyantModule = ${JSON.stringify(packedVoyantModule)}\n`,
  })

  const problems = await inspectPackedVoyantManifestRuntimeExports(root, root, manifest)

  assert.deepEqual(problems, [])
})

test("checks named exports from the packed manifest instead of workspace source", async () => {
  const manifest = packedManifest({
    "./runtime-contributor": "./dist/runtime-contributor.js",
    "./setup/vouchers": "./dist/service-vouchers-migration.js",
    "./voyant": "./dist/voyant.js",
  })
  const root = createPackedPackageFixture(manifest, {
    "dist/runtime-contributor.js": "export function createFinanceRuntimePortContribution() {}\n",
    "dist/service-vouchers-migration.js": "export function staleVoucherMigration() {}\n",
    "dist/voyant.js": `export const financeVoyantModule = ${JSON.stringify(financeVoyantModule)}\n`,
    "src/voyant.ts": "export const financeVoyantModule = { setupMigrations: [] }\n",
  })

  const problems = await inspectPackedVoyantManifestRuntimeExports(root, root, manifest)

  assert.deepEqual(problems, [
    "runtime entry @voyant-travel/finance/setup/vouchers does not export runVoucherSetupMigration",
  ])
})

function packedManifest(exports) {
  return {
    name: "@voyant-travel/finance",
    exports,
    voyant: {
      manifest: "./voyant",
      runtime: {
        entry: "./runtime-contributor",
        export: "createFinanceRuntimePortContribution",
      },
    },
  }
}

const financeVoyantModule = {
  schemaVersion: "voyant.module.v1",
  id: "@voyant-travel/finance",
  packageName: "@voyant-travel/finance",
  setupMigrations: [
    {
      id: "@voyant-travel/finance#setup.vouchers",
      runtime: {
        entry: "@voyant-travel/finance/setup/vouchers",
        export: "runVoucherSetupMigration",
      },
    },
  ],
  tools: [
    {
      id: "@voyant-travel/finance#tool.external",
      runtime: {
        entry: "@voyant-travel/external/tool",
        export: "externalTool",
      },
    },
  ],
}

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

function createPackedPackageFixture(manifest, files) {
  return createFixture({
    "package.json": JSON.stringify({ type: "module", ...manifest }),
    ...files,
  })
}
