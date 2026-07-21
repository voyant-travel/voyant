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

  function expansionClient(
    options: {
      existing?: boolean
      tables?: string[]
      columns?: Array<[string, string]>
      recordedSources?: string[]
    } = {},
  ) {
    const queries: string[] = []
    const executedCreates: string[] = []
    const inserted: Array<{ source: string; tag: string; contentHash: string }> = []
    const existing = options.existing ?? true
    const recordedSources = options.recordedSources ?? []
    const client: MigrationClient = {
      async query(sql: string, params: unknown[] = []) {
        queries.push(sql)
        if (sql.startsWith("SELECT to_regclass")) {
          return { rows: [{ reg: String(params[0]) }] }
        }
        if (sql.includes("count(*)")) {
          if (sql.includes('"drizzle"."__drizzle_migrations"')) {
            return { rows: [{ n: existing ? "45" : "0" }] }
          }
          return { rows: [{ n: "0" }] }
        }
        if (sql.includes('SELECT DISTINCT "source"')) {
          return { rows: recordedSources.map((source) => ({ source })) }
        }
        if (sql.includes('SELECT "source", "tag" FROM')) return { rows: [] }
        if (sql.includes('SELECT "content_hash", "source" FROM')) return { rows: [] }
        if (sql.includes("information_schema.tables")) {
          return { rows: (options.tables ?? []).map((table_name) => ({ table_name })) }
        }
        if (sql.includes("information_schema.columns")) {
          return {
            rows: (options.columns ?? []).map(([table_name, column_name]) => ({
              table_name,
              column_name,
            })),
          }
        }
        if (sql.includes("pg_constraint")) return { rows: [] }
        if (sql.startsWith('CREATE TABLE "')) executedCreates.push(sql)
        if (sql.startsWith("INSERT INTO") && params.length === 3) {
          inserted.push({
            source: String(params[0]),
            tag: String(params[1]),
            contentHash: String(params[2]),
          })
        }
        return { rows: [] }
      },
    }
    return { client, executedCreates, inserted, queries }
  }

  function profileExpansionSource(name: string, tableCount: number): MigrationSource {
    return {
      name,
      priority: 1,
      migrations: [
        {
          tag: `0000_${name}_baseline`,
          sql: Array.from(
            { length: tableCount },
            (_, index) =>
              `CREATE TABLE "${name.replaceAll("-", "_")}_${index}" (\n\t"id" text PRIMARY KEY NOT NULL\n);`,
          ).join("\n--> statement-breakpoint\n"),
        },
      ],
    }
  }

  it("executes wholly-absent unledgered sources when an existing profile expands", async () => {
    // Mirrors ProTravel's managed-profile delta exactly: accommodations adds
    // eight cutline tables, charters seven, and cruises nineteen. None of the
    // three sources or tables existed in the tenant before the profile grew.
    const sources = [
      profileExpansionSource("accommodations", 8),
      profileExpansionSource("charters", 7),
      profileExpansionSource("cruises", 19),
    ]
    const cutline = Object.fromEntries(
      sources.map((source) => [source.name, [source.migrations[0]?.tag as string]]),
    )
    const { client, executedCreates, inserted } = expansionClient()

    const result = await runDeploymentMigrations(client, sources, cutline)

    expect(result.existing).toBe(true)
    expect(result.baselined).toEqual([])
    expect(result.executed).toEqual([
      "accommodations/0000_accommodations_baseline",
      "charters/0000_charters_baseline",
      "cruises/0000_cruises_baseline",
    ])
    expect(executedCreates).toHaveLength(8 + 7 + 19)
    expect(inserted.map(({ source, tag }) => `${source}/${tag}`)).toEqual(result.executed)
  })

  it("import-baselines a fully-present unledgered source when an existing profile expands", async () => {
    const source = profileExpansionSource("accommodations", 2)
    const { client, executedCreates, inserted } = expansionClient({
      tables: ["accommodations_0", "accommodations_1"],
      columns: [
        ["accommodations_0", "id"],
        ["accommodations_1", "id"],
      ],
    })

    const result = await runDeploymentMigrations(client, [source], {
      accommodations: ["0000_accommodations_baseline"],
    })

    expect(result.existing).toBe(true)
    expect(result.executed).toEqual([])
    expect(result.baselined).toEqual(["accommodations/0000_accommodations_baseline"])
    expect(executedCreates).toEqual([])
    expect(inserted.map(({ source, tag }) => `${source}/${tag}`)).toEqual(result.baselined)
  })

  it("refuses a partially-present unledgered source instead of executing or baselining it", async () => {
    const source = profileExpansionSource("accommodations", 8)
    const firstTable = "accommodations_0"
    const { client, executedCreates, queries } = expansionClient({
      tables: [firstTable],
      columns: [[firstTable, "id"]],
    })

    await expect(
      runDeploymentMigrations(client, [source], {
        accommodations: ["0000_accommodations_baseline"],
      }),
    ).rejects.toThrow("7 expected table(s) missing")
    expect(executedCreates).toEqual([])
    expect(queries[0]).toContain("pg_advisory_lock")
    expect(queries.some((sql) => sql.startsWith("CREATE SCHEMA"))).toBe(false)
    expect(queries.some((sql) => sql.startsWith("INSERT INTO"))).toBe(false)
    expect(queries.some((sql) => sql === "BEGIN")).toBe(false)
    expect(queries.at(-1)).toContain("pg_advisory_unlock")
  })

  it.each([
    ["stable", undefined, "accommodations"],
    [
      "legacy",
      ["schema:@voyant-travel/accommodations#migrations"],
      "schema:@voyant-travel/accommodations#migrations",
    ],
  ] as const)("refuses an absent source with existing %s ledger lineage", async (_kind, legacyNames, recordedSource) => {
    const source = {
      ...profileExpansionSource("accommodations", 8),
      ...(legacyNames ? { legacyNames } : {}),
    }
    const { client, executedCreates } = expansionClient({
      recordedSources: [recordedSource],
    })

    await expect(
      runDeploymentMigrations(client, [source], {
        accommodations: ["0000_accommodations_baseline"],
      }),
    ).rejects.toThrow("8 expected table(s) missing")
    expect(executedCreates).toEqual([])
  })

  it("keeps fresh databases on the normal execute-from-scratch path", async () => {
    const source = profileExpansionSource("accommodations", 2)
    const { client, executedCreates } = expansionClient({ existing: false })

    const result = await runDeploymentMigrations(client, [source], {
      accommodations: ["0000_accommodations_baseline"],
    })

    expect(result.existing).toBe(false)
    expect(result.baselined).toEqual([])
    expect(result.executed).toEqual(["accommodations/0000_accommodations_baseline"])
    expect(executedCreates).toHaveLength(2)
  })

  it("still import-baselines cutline rows and executes post-cutline increments", async () => {
    const source: MigrationSource = {
      ...profileExpansionSource("accommodations", 1),
      migrations: [
        {
          tag: "0000_accommodations_baseline",
          sql: 'CREATE TABLE "accommodations_0" (\n\t"id" text PRIMARY KEY NOT NULL\n);',
        },
        {
          tag: "0001_accommodations_increment",
          sql: 'CREATE TABLE "accommodations_increment" (\n\t"id" text PRIMARY KEY NOT NULL\n);',
        },
      ],
    }
    const { client, executedCreates } = expansionClient({
      tables: ["accommodations_0"],
      columns: [["accommodations_0", "id"]],
    })

    const result = await runDeploymentMigrations(client, [source], {
      accommodations: ["0000_accommodations_baseline"],
    })

    expect(result.baselined).toEqual(["accommodations/0000_accommodations_baseline"])
    expect(result.executed).toEqual(["accommodations/0001_accommodations_increment"])
    expect(executedCreates).toEqual([
      'CREATE TABLE "accommodations_increment" (\n\t"id" text PRIMARY KEY NOT NULL\n);',
    ])
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
