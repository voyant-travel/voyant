import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")

describe("operator action ledger schema mounting", () => {
  it("keeps the action ledger schema mounted in the generated schema manifest", () => {
    const config = readFileSync(
      resolve(repoRoot, "templates/operator/drizzle.schemas.generated.ts"),
      "utf8",
    )

    expect(config).toContain("../../packages/action-ledger/src/schema.ts")
  })

  it("keeps the action ledger migration in the operator template", () => {
    const migration = readFileSync(
      resolve(repoRoot, "templates/operator/migrations/0017_action_ledger.sql"),
      "utf8",
    )

    expect(migration).toContain('CREATE TABLE "action_ledger_entries"')
    expect(migration).toContain('CREATE TABLE "action_approvals"')
    expect(migration).toContain('CREATE TABLE "action_mutation_details"')
    expect(migration).toContain('CREATE TABLE "action_ledger_outbox"')
  })
})
