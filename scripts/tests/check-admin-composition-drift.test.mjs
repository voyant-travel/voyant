import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

const ROOT = join(import.meta.dirname, "..", "..")
const CHECKER = join(ROOT, "scripts/check-admin-composition-drift.mjs")

test("derives expected admin entries from the resolved graph, not voyant.config", () => {
  const dir = mkdtempSync(join(tmpdir(), "voyant-admin-composition-"))
  const graph = join(dir, "deployment-graph.generated.json")
  const extensions = join(dir, "admin.extensions.generated.ts")
  const bundle = join(dir, "selected-graph-admin.generated.ts")
  const compatibility = join(dir, "admin-extensions.tsx")

  try {
    writeFileSync(graph, JSON.stringify({ modules: [], plugins: [] }))
    writeFileSync(bundle, "export const selectedGraphAdminExtensionFactories = {}\n")
    writeFileSync(compatibility, "export const extensions = []\n")

    assert.doesNotThrow(() => runChecker({ graph, extensions, bundle, compatibility }))

    writeFileSync(
      graph,
      JSON.stringify({
        modules: [
          {
            api: [{ surface: "admin" }],
            packageName: "@voyant-travel/action-ledger",
          },
        ],
        plugins: [],
      }),
    )

    assert.throws(
      () => runChecker({ graph, extensions, bundle, compatibility }),
      /selected by the deployment graph.*does not declare admin\.runtime/s,
    )
  } finally {
    rmSync(dir, { force: true, recursive: true })
  }
})

test("requires migrated UI-only admin factories only in the selected-graph bundle", () => {
  const dir = mkdtempSync(join(tmpdir(), "voyant-admin-bundle-"))
  const graph = join(dir, "deployment-graph.generated.json")
  const extensions = join(dir, "admin.extensions.generated.ts")
  const bundle = join(dir, "selected-graph-admin.generated.ts")
  const compatibility = join(dir, "admin-extensions.tsx")

  try {
    writeFileSync(
      graph,
      JSON.stringify({
        modules: [
          {
            admin: { runtime: { entry: "@voyant-travel/action-ledger-react/admin" } },
            packageName: "@voyant-travel/action-ledger",
          },
        ],
        plugins: [],
      }),
    )
    writeFileSync(
      bundle,
      'import { createActionLedgerAdminExtension } from "@voyant-travel/action-ledger-react/admin"\n',
    )
    writeFileSync(compatibility, "export const extensions = []\n")

    assert.doesNotThrow(() => runChecker({ graph, extensions, bundle, compatibility }))

    writeFileSync(extensions, "export const generatedAdminExtensionFactories = {}\n")
    assert.throws(
      () => runChecker({ graph, extensions, bundle, compatibility }),
      /admin\.extensions\.generated\.ts must not exist/,
    )

    rmSync(extensions, { force: true })
    writeFileSync(
      compatibility,
      'selectedGraphAdminExtensionFactories["@voyant-travel/action-ledger"]({})\n',
    )
    assert.throws(
      () => runChecker({ graph, extensions, bundle, compatibility }),
      /remains package-keyed in the Operator compatibility registry/,
    )

    writeFileSync(
      compatibility,
      'import "@voyant-travel/action-ledger-react/admin"\nexport const extensions = []\n',
    )
    assert.throws(
      () => runChecker({ graph, extensions, bundle, compatibility }),
      /remains imported by the Operator admin compatibility composition/,
    )
  } finally {
    rmSync(dir, { force: true, recursive: true })
  }
})

function runChecker({ graph, extensions, bundle, compatibility }) {
  return execFileSync(
    process.execPath,
    [
      CHECKER,
      "--graph",
      graph,
      "--extensions",
      extensions,
      "--bundle",
      bundle,
      "--compatibility",
      compatibility,
    ],
    { encoding: "utf8" },
  )
}
