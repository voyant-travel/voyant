import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")

describe("operator action ledger schema mounting", () => {
  it("keeps the action ledger schema in the migration schema set", () => {
    const artifacts = JSON.parse(
      readFileSync(
        resolve(repoRoot, "starters/operator/.voyant/deployment-artifacts.generated.json"),
        "utf8",
      ),
    ) as { migrationSources: Array<{ packageName: string; schema: string }> }
    expect(artifacts.migrationSources).toContainEqual({
      packageName: "@voyant-travel/action-ledger",
      schema: "@voyant-travel/action-ledger/schema",
    })
  })

  it("keeps the action ledger migration in the framework bundle", () => {
    // The action ledger is package-owned: its CREATE TABLEs ship in the
    // framework migration bundle (collector source `framework`), not in the
    // a deployment-owned aggregate migration folder.
    const migration = readFileSync(
      resolve(repoRoot, "packages/framework-migrations/migrations/0000_framework_baseline.sql"),
      "utf8",
    )

    expect(migration).toContain('CREATE TABLE "action_ledger_entries"')
    expect(migration).toContain('CREATE TABLE "action_approvals"')
    expect(migration).toContain('CREATE TABLE "action_mutation_details"')
    expect(migration).toContain('CREATE TABLE "action_ledger_outbox"')
  })
})
