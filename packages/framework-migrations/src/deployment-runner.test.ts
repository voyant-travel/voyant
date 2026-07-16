import { describe, expect, it } from "vitest"
import type { MigrationClient, MigrationSource } from "./collector.js"
import { detectExisting, expectedSchema, runDeploymentMigrations } from "./deployment-runner.js"

const src = (name: string, sqls: string[]): MigrationSource => ({
  name,
  priority: name === "deployment" ? 1 : 0,
  migrations: sqls.map((sql, i) => ({ tag: `000${i}_${name}`, sql })),
})

describe("expectedSchema", () => {
  it("collects CREATE TABLE columns and ALTER ADD COLUMN", () => {
    const e = expectedSchema([
      src("pkg", [
        `CREATE TABLE "people" (\n\t"id" text PRIMARY KEY NOT NULL,\n\t"name" text\n);`,
        `ALTER TABLE "people" ADD COLUMN "email" text;`,
      ]),
    ])
    expect(e.tables.has("people")).toBe(true)
    expect([...e.columns].sort()).toEqual(["people.email", "people.id", "people.name"])
  })

  it("does NOT expect a column added then later DROPPED (net add/drop wins)", () => {
    const e = expectedSchema([
      src("pkg", [
        `CREATE TABLE "quotes" (\n\t"id" text PRIMARY KEY NOT NULL,\n\t"currency" text NOT NULL\n);`,
      ]),
      // a later deployment migration reverts the experiment
      src("deployment", [`ALTER TABLE "quotes" DROP COLUMN "currency";`]),
    ])
    expect(e.columns.has("quotes.id")).toBe(true)
    expect(e.columns.has("quotes.currency")).toBe(false)
  })

  it("honors DROP COLUMN IF EXISTS", () => {
    const e = expectedSchema([
      src("pkg", [`CREATE TABLE "t" (\n\t"id" text PRIMARY KEY NOT NULL,\n\t"x" text\n);`]),
      src("deployment", [`ALTER TABLE "t" DROP COLUMN IF EXISTS "x";`]),
    ])
    expect(e.columns.has("t.x")).toBe(false)
  })

  it("expects a RENAMED column under its NEW name, not the original", () => {
    const e = expectedSchema([
      src("pkg", [
        `CREATE TABLE "people" (\n\t"id" text PRIMARY KEY NOT NULL,\n\t"birthday" date\n);`,
      ]),
      src("deployment", [`ALTER TABLE "people" RENAME COLUMN "birthday" TO "date_of_birth";`]),
    ])
    expect(e.columns.has("people.birthday")).toBe(false)
    expect(e.columns.has("people.date_of_birth")).toBe(true)
  })

  it("drops a table's columns when the table itself is dropped", () => {
    const e = expectedSchema([
      src("pkg", [`CREATE TABLE "tmp" (\n\t"id" text PRIMARY KEY NOT NULL,\n\t"v" text\n);`]),
      src("deployment", [`DROP TABLE "tmp";`]),
    ])
    expect(e.tables.has("tmp")).toBe(false)
    expect(e.dropped.has("tmp")).toBe(true)
    expect([...e.columns].some((c) => c.startsWith("tmp."))).toBe(false)
  })
})

describe("runDeploymentMigrations on a partially adopted database", () => {
  it("does not re-assert cutline schema for already-recorded entries", async () => {
    // Ledger state: adoption already recorded action-ledger's covered baseline,
    // and an applied post-cutline increment legitimately DROPPED its outbox
    // table. A rerun must not demand the cutline-era outbox schema again.
    const ledgerRows = [
      { source: "framework", tag: "0000_framework_baseline", content_hash: "h-framework" },
      { source: "action-ledger", tag: "0000_action_ledger_baseline", content_hash: "h-covered" },
      {
        source: "action-ledger",
        tag: "0001_remove_outbox",
        content_hash: "b48b95e2b1ec55da472472782e63f89a5f6f8e0f5f26c8f24825ffe7dad5d33c",
      },
    ]
    const client: MigrationClient = {
      async query(sql: string, params: unknown[] = []) {
        if (sql.startsWith("SELECT to_regclass")) return { rows: [{ reg: String(params[0]) }] }
        if (sql.includes("count(*)")) return { rows: [{ n: "1" }] }
        if (sql.includes('SELECT "source", "tag" FROM')) {
          return { rows: ledgerRows.map(({ source, tag }) => ({ source, tag })) }
        }
        if (sql.includes('SELECT "content_hash", "source" FROM')) {
          // applyMigrations per-migration lookup: report both recorded rows.
          return { rows: [] }
        }
        if (sql.includes("information_schema.tables")) {
          return { rows: [] } // outbox (and everything else) absent
        }
        if (sql.includes("information_schema.columns")) return { rows: [] }
        if (sql.includes("pg_constraint")) return { rows: [] }
        return { rows: [] }
      },
    }

    const sources = [
      {
        name: "action-ledger",
        priority: 1,
        migrations: [
          {
            tag: "0000_action_ledger_baseline",
            sql: 'CREATE TABLE "action_ledger_outbox" ("id" text PRIMARY KEY);',
          },
        ],
      },
    ]
    const cutline = { "action-ledger": ["0000_action_ledger_baseline"] }

    // Without the recorded-entry filter this throws "NOT at the cutline schema"
    // (the outbox table is gone). With it, the covered entry is already
    // recorded, nothing is left to parity-gate, and the run proceeds.
    const result = await runDeploymentMigrations(client, sources, cutline)
    expect(result.existing).toBe(true)
  })
})

describe("detectExisting", () => {
  it("recognizes graph-era package ledger source names", async () => {
    const client: MigrationClient = {
      async query(sql, params = []) {
        if (sql.startsWith("SELECT to_regclass")) {
          return { rows: [{ reg: String(params[0]) }] }
        }
        if (sql.includes(`"source" LIKE 'schema:%#migrations'`)) {
          return { rows: [{ n: "1" }] }
        }
        return { rows: [{ n: "0" }] }
      },
    }

    await expect(detectExisting(client)).resolves.toBe(true)
  })
})
