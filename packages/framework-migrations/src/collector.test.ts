import { Client } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  applyMigrations,
  MigrationImmutabilityError,
  type MigrationSource,
  planMigrations,
} from "./collector.js"

const DB_URL = process.env.TEST_DATABASE_URL
const SCHEMA = "voyant_fwmig_test"

// ---- planMigrations: pure, no DB --------------------------------------------

describe("planMigrations", () => {
  it("orders by (source priority, in-source sequence)", () => {
    const plan = planMigrations([
      { name: "deployment", priority: 1, migrations: [{ tag: "d0", sql: "select 1" }] },
      {
        name: "framework",
        priority: 0,
        migrations: [
          { tag: "f0", sql: "select 1" },
          { tag: "f1", sql: "select 2" },
        ],
      },
    ])
    expect(plan.map((p) => `${p.source}/${p.tag}`)).toEqual([
      "framework/f0",
      "framework/f1",
      "deployment/d0",
    ])
  })

  it("hashes by SQL content (different SQL → different hash)", () => {
    const [a] = planMigrations([{ name: "x", priority: 0, migrations: [{ tag: "t", sql: "A" }] }])
    const [b] = planMigrations([{ name: "x", priority: 0, migrations: [{ tag: "t", sql: "B" }] }])
    expect(a?.contentHash).toBeTypeOf("string")
    expect(a?.contentHash).not.toBe(b?.contentHash)
  })
})

// ---- applyMigrations: integration (the spike's scenarios) -------------------

function sources(): { framework: MigrationSource; deployment: MigrationSource } {
  return {
    framework: {
      name: "framework",
      priority: 0,
      migrations: [
        { tag: "0001_init", sql: `CREATE TABLE ${SCHEMA}.bookings (id text PRIMARY KEY);` },
        { tag: "0002_add_status", sql: `ALTER TABLE ${SCHEMA}.bookings ADD COLUMN status text;` },
      ],
    },
    deployment: {
      name: "deployment",
      priority: 1,
      // FK into a framework table — fails outright if applied before framework.
      migrations: [
        {
          tag: "0001_acme_notes",
          sql: `CREATE TABLE ${SCHEMA}.acme_notes (id text PRIMARY KEY, booking_id text REFERENCES ${SCHEMA}.bookings(id));`,
        },
      ],
    },
  }
}

const ledgerOpts = { ledgerSchema: SCHEMA, ledgerTable: "_voyant_migrations" }

describe.skipIf(!DB_URL)("applyMigrations (integration)", () => {
  let client: Client

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
  })

  afterAll(async () => {
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
      await client.end()
    }
  })

  beforeEach(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
    await client.query(`CREATE SCHEMA ${SCHEMA}`)
  })

  async function tableExists(name: string): Promise<boolean> {
    const r = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2",
      [SCHEMA, name],
    )
    return r.rows.length > 0
  }

  it("scenario 1+5 — fresh apply is framework-first; deployment FK resolves", async () => {
    const s = sources()
    const applied = await applyMigrations(client, [s.framework, s.deployment], ledgerOpts)
    expect(applied).toEqual([
      "framework/0001_init",
      "framework/0002_add_status",
      "deployment/0001_acme_notes",
    ])
    expect(await tableExists("bookings")).toBe(true)
    // The deployment table FKs into the framework table — exists only because
    // framework was applied first (ordering is load-bearing).
    expect(await tableExists("acme_notes")).toBe(true)
  })

  it("scenario 2 — re-run is idempotent (applies nothing)", async () => {
    const s = sources()
    await applyMigrations(client, [s.framework, s.deployment], ledgerOpts)
    const second = await applyMigrations(client, [s.framework, s.deployment], ledgerOpts)
    expect(second).toEqual([])
  })

  it("scenario 3 — a framework upgrade applies only the new migration", async () => {
    const s = sources()
    await applyMigrations(client, [s.framework, s.deployment], ledgerOpts)

    const upgraded = sources()
    upgraded.framework.migrations.push({
      tag: "0003_add_index",
      sql: `CREATE INDEX bookings_status_idx ON ${SCHEMA}.bookings (status);`,
    })
    const applied = await applyMigrations(
      client,
      [upgraded.framework, upgraded.deployment],
      ledgerOpts,
    )
    expect(applied).toEqual(["framework/0003_add_index"])
  })

  it("scenario 4 — editing an applied migration is a hard error", async () => {
    const s = sources()
    await applyMigrations(client, [s.framework, s.deployment], ledgerOpts)

    const tampered = sources()
    tampered.framework.migrations[0]!.sql =
      `CREATE TABLE ${SCHEMA}.bookings (id text PRIMARY KEY, tampered boolean);`
    await expect(
      applyMigrations(client, [tampered.framework, tampered.deployment], ledgerOpts),
    ).rejects.toBeInstanceOf(MigrationImmutabilityError)
  })

  it("splits drizzle statement-breakpoints within one migration", async () => {
    const multi: MigrationSource = {
      name: "framework",
      priority: 0,
      migrations: [
        {
          tag: "0001_multi",
          sql: `CREATE TABLE ${SCHEMA}.a (id text);\n--> statement-breakpoint\nCREATE TABLE ${SCHEMA}.b (id text);`,
        },
      ],
    }
    await applyMigrations(client, [multi], ledgerOpts)
    expect(await tableExists("a")).toBe(true)
    expect(await tableExists("b")).toBe(true)
  })
})
