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

  try {
    writeFileSync(graph, JSON.stringify({ modules: [], plugins: [] }))
    writeFileSync(extensions, "export const generatedAdminExtensionFactories = {}\n")
    writeFileSync(bundle, "export const selectedGraphAdminExtensionFactories = {}\n")

    assert.doesNotThrow(() => runChecker({ graph, extensions, bundle }))

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
      () => runChecker({ graph, extensions, bundle }),
      /selected by the deployment graph.*missing from admin\.extensions\.generated\.ts/s,
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
    writeFileSync(extensions, "export const generatedAdminExtensionFactories = {}\n")
    writeFileSync(
      bundle,
      'import { createActionLedgerAdminExtension } from "@voyant-travel/action-ledger-react/admin"\n',
    )

    assert.doesNotThrow(() => runChecker({ graph, extensions, bundle }))

    writeFileSync(
      extensions,
      'import { createActionLedgerAdminExtension } from "@voyant-travel/action-ledger-react/admin"\n',
    )
    assert.throws(
      () => runChecker({ graph, extensions, bundle }),
      /duplicated in admin\.extensions\.generated\.ts/,
    )
  } finally {
    rmSync(dir, { force: true, recursive: true })
  }
})

function runChecker({ graph, extensions, bundle }) {
  return execFileSync(
    process.execPath,
    [CHECKER, "--graph", graph, "--extensions", extensions, "--bundle", bundle],
    { encoding: "utf8" },
  )
}
