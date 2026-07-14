import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, test } from "node:test"

import { packedFileExportsName } from "../lib/packed-exports.mjs"
import { collectPackedManifestRuntimeExportProblems } from "../verify-package-tarballs.mjs"

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

test("reports package-owned runtime entries missing from packed exports", () => {
  const problems = collectPackedManifestRuntimeExportProblems(
    packedManifest({
      "./runtime-contributor": "./dist/runtime-contributor.js",
      "./voyant": "./dist/voyant.js",
    }),
    { financeVoyantModule },
  )

  assert.deepEqual(problems, [
    "runtime entry @voyant-travel/finance/setup/vouchers is not exported as ./setup/vouchers",
  ])
})

test("accepts relative and canonical package runtime entries exported by the packed package", () => {
  const problems = collectPackedManifestRuntimeExportProblems(
    packedManifest({
      "./runtime-contributor": {
        import: "./dist/runtime-contributor.js",
        types: "./dist/runtime-contributor.d.ts",
      },
      "./setup/vouchers": {
        import: "./dist/service-vouchers-migration.js",
        types: "./dist/service-vouchers-migration.d.ts",
      },
      "./voyant": "./dist/voyant.js",
    }),
    {
      financeVoyantModule: {
        ...financeVoyantModule,
        subscribers: [
          {
            id: "@voyant-travel/finance#subscriber.local",
            runtime: { entry: "./setup/vouchers", export: "runVoucherSetupMigration" },
          },
        ],
      },
    },
  )

  assert.deepEqual(problems, [])
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
