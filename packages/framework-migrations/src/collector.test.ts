import { Client } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  applyD2Migrations,
  applyMigrations,
  importBaseline,
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

  // ---- importBaseline: record an existing schema without re-executing --------

  it("baseline records the ledger WITHOUT executing any SQL", async () => {
    const s = sources()
    const imported = await importBaseline(client, [s.framework, s.deployment], ledgerOpts)
    // Every planned migration is recorded …
    expect(imported).toEqual([
      "framework/0001_init",
      "framework/0002_add_status",
      "deployment/0001_acme_notes",
    ])
    // … but none of their SQL ran (the schema is assumed already present).
    expect(await tableExists("bookings")).toBe(false)
    expect(await tableExists("acme_notes")).toBe(false)
  })

  it("a baselined deployment then applies nothing (ledger interop with applyMigrations)", async () => {
    const s = sources()
    await importBaseline(client, [s.framework, s.deployment], ledgerOpts)
    // applyMigrations sees the baselined (source, tag) rows and skips them —
    // so it does NOT try to re-create the already-existing schema.
    const applied = await applyMigrations(client, [s.framework, s.deployment], ledgerOpts)
    expect(applied).toEqual([])
    // A genuinely new migration still applies after a baseline.
    const upgraded = sources()
    upgraded.framework.migrations.push({
      tag: "0003_add_index",
      sql: `CREATE TABLE ${SCHEMA}.bookings (id text PRIMARY KEY); CREATE INDEX bookings_status_idx ON ${SCHEMA}.bookings (id);`,
    })
    const next = await applyMigrations(
      client,
      [upgraded.framework, upgraded.deployment],
      ledgerOpts,
    )
    expect(next).toEqual(["framework/0003_add_index"])
  })

  it("baseline is idempotent (re-run records nothing new)", async () => {
    const s = sources()
    await importBaseline(client, [s.framework, s.deployment], ledgerOpts)
    const second = await importBaseline(client, [s.framework, s.deployment], ledgerOpts)
    expect(second).toEqual([])
  })
})

// ---- applyD2Migrations: the dual-path collector (slice 3b) -------------------

const D2_SCHEMA = "voyant_fwmig_d2_test"
const d2Ledger = { ledgerSchema: D2_SCHEMA, ledgerTable: "_voyant_migrations" }

/** Two package sources (db → catalog) with a post-cutline catalog increment. */
function d2Sources(): { db: MigrationSource; catalog: MigrationSource } {
  return {
    db: {
      name: "db",
      priority: 0,
      migrations: [
        { tag: "0000_db_baseline", sql: `CREATE TABLE ${D2_SCHEMA}.org (id text PRIMARY KEY);` },
      ],
    },
    catalog: {
      name: "catalog",
      priority: 1,
      migrations: [
        {
          tag: "0000_catalog_baseline",
          sql: `CREATE TABLE ${D2_SCHEMA}.product (id text PRIMARY KEY, org_id text REFERENCES ${D2_SCHEMA}.org(id));`,
        },
        // post-cutline increment (NOT in the cutline) — executes even on existing DBs
        { tag: "0001_add_sku", sql: `ALTER TABLE ${D2_SCHEMA}.product ADD COLUMN sku text;` },
      ],
    },
  }
}

// bundle materialised the baselines, not the post-cutline increment
const d2Cutline = { db: ["0000_db_baseline"], catalog: ["0000_catalog_baseline"] }

describe.skipIf(!DB_URL)("applyD2Migrations (dual-path)", () => {
  let client: Client

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
  })
  afterAll(async () => {
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS ${D2_SCHEMA} CASCADE`)
      await client.end()
    }
  })
  beforeEach(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${D2_SCHEMA} CASCADE`)
    await client.query(`CREATE SCHEMA ${D2_SCHEMA}`)
  })

  const has = async (table: string, column?: string): Promise<boolean> => {
    const r = column
      ? await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3",
          [D2_SCHEMA, table, column],
        )
      : await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2",
          [D2_SCHEMA, table],
        )
    return r.rows.length > 0
  }
  const ledgerIds = async (): Promise<string[]> => {
    const r = await client.query(
      `SELECT source, tag FROM ${D2_SCHEMA}._voyant_migrations ORDER BY source, tag`,
    )
    return r.rows.map((row) => `${row.source}/${row.tag}`)
  }

  it("fresh — executes every package source, baselines nothing", async () => {
    const s = d2Sources()
    const r = await applyD2Migrations(client, [s.db, s.catalog], {
      ...d2Ledger,
      cutline: d2Cutline,
      existing: false,
    })
    expect(r.executed).toEqual([
      "db/0000_db_baseline",
      "catalog/0000_catalog_baseline",
      "catalog/0001_add_sku",
    ])
    expect(r.baselined).toEqual([])
    expect(await has("org")).toBe(true)
    expect(await has("product", "sku")).toBe(true)
  })

  it("existing — import-baselines the cutline, executes the post-cutline increment, keeps framework/* rows", async () => {
    const s = d2Sources()
    // Simulate a materialised D.1 database: the bundle already created the
    // baseline tables (no sku) and recorded an inert framework/* ledger row.
    await client.query(`CREATE TABLE ${D2_SCHEMA}.org (id text PRIMARY KEY)`)
    await client.query(
      `CREATE TABLE ${D2_SCHEMA}.product (id text PRIMARY KEY, org_id text REFERENCES ${D2_SCHEMA}.org(id))`,
    )
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${D2_SCHEMA}`)
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${D2_SCHEMA}._voyant_migrations
         (source text NOT NULL, tag text NOT NULL, content_hash text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (source, tag))`,
    )
    await client.query(
      `INSERT INTO ${D2_SCHEMA}._voyant_migrations (source, tag, content_hash) VALUES ('framework','0000_baseline','deadbeef')`,
    )

    const r = await applyD2Migrations(client, [s.db, s.catalog], {
      ...d2Ledger,
      cutline: d2Cutline,
      existing: true,
    })
    // baselines recorded without executing (tables already existed — no double-create)
    expect(r.baselined.sort()).toEqual(["catalog/0000_catalog_baseline", "db/0000_db_baseline"])
    // the post-cutline increment executes
    expect(r.executed).toEqual(["catalog/0001_add_sku"])
    expect(await has("product", "sku")).toBe(true)
    // framework/* history preserved + package rows recorded
    const ids = await ledgerIds()
    expect(ids).toContain("framework/0000_baseline")
    expect(ids).toContain("db/0000_db_baseline")
    expect(ids).toContain("catalog/0001_add_sku")
  })

  it("existing re-run is idempotent (nothing executed or baselined)", async () => {
    const s = d2Sources()
    await applyD2Migrations(client, [s.db, s.catalog], {
      ...d2Ledger,
      cutline: d2Cutline,
      existing: false,
    })
    const again = await applyD2Migrations(client, [s.db, s.catalog], {
      ...d2Ledger,
      cutline: d2Cutline,
      existing: true,
    })
    expect(again.executed).toEqual([])
    expect(again.baselined).toEqual([])
  })
})
