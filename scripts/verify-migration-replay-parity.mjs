/**
 * D.1 replay-parity oracle (Workstream D.1, slice 3 — the safety gate for the
 * runner cutover). Proves that the NEW migration sources reconstitute EXACTLY
 * the canonical CURRENT schema:
 *
 *   framework bundle   (packages/framework-migrations/migrations)
 *   + deployment links (starters/operator/migrations-d1)
 *   ===  drizzle-kit push of the live aggregate schema (drizzle.config.ts)
 *
 * WHY push, not a legacy replay. The committed legacy history
 * (`starters/operator/migrations/`) is BOTH incomplete and stale, so it is not
 * a valid canonical-schema source (measured 2026-06-17 — see
 * docs/architecture/migration-collector-d1.md):
 *   • INCOMPLETE — 16 tables in the live schema have no CREATE migration at all
 *     (the whole operations/ground module: ground_dispatches/_drivers/_vehicles/
 *     transfer_preferences/…; plus quote versioning: quote_versions/_lines/
 *     _participants/_products). On real deployments they exist only via
 *     `drizzle-kit push`. A dangling `ALTER TABLE "ground_transfer_preferences"`
 *     in 20260613120000 then fails on any migration-only replay.
 *   • STALE — ~40 CREATEs for retired tables (orders/offers/opportunities/
 *     transaction_* per 0068; crm_*_products links replaced by relationships_*).
 *   • NON-FRESH-REPLAYABLE — 0068 `DROP TABLE "orders"` lacks CASCADE while
 *     payment_sessions/payment_authorizations still FK in; it only ever applied
 *     out of journal order, which is why every dev DB is stuck at migration 60.
 *
 * `drizzle-kit push` of the SAME aggregate schema the bundle is generated from
 * IS the canonical current schema (it is exactly how production materialised the
 * un-migrated drift tables). If `bundle + links` fingerprint-matches it, then
 * baselining an existing current deployment onto the new ledger (slice 4) is
 * safe. Measured equality on 2026-06-17: 339 tables / 4371 columns / 1295 enum
 * labels / 1816 indexes / 3089 constraints, zero diffs.
 *
 * Run: TEST_DATABASE_URL=<postgres url, user with CREATEDB> node scripts/verify-migration-replay-parity.mjs
 *   (skips cleanly when no DB is configured).
 */
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

const require = createRequire(new URL("../starters/operator/package.json", import.meta.url))
const { Client } = require("pg")

const ROOT = new URL("..", import.meta.url).pathname
const DB_URL = process.env.TEST_DATABASE_URL
if (!DB_URL) {
  console.log(
    "verify-migration-replay-parity: SKIP (set TEST_DATABASE_URL to a CREATEDB-capable Postgres)",
  )
  process.exit(0)
}

const FRAMEWORK_BUNDLE = join(ROOT, "packages/framework-migrations/migrations")
const DEPLOYMENT_LINKS = join(ROOT, "starters/operator/migrations-d1")
const OPERATOR_DIR = join(ROOT, "starters/operator")

// Extensions the live schema's trigram indexes need. The bundle ships these as a
// preamble; `drizzle-kit push` does NOT emit CREATE EXTENSION, so the push DB
// gets them seeded first (postgis is intentionally omitted — the schema creates
// cleanly without it, and plain Postgres images don't ship it).
const SEED_EXTENSIONS = [
  'CREATE EXTENSION IF NOT EXISTS "pg_trgm"',
  'CREATE EXTENSION IF NOT EXISTS "unaccent"',
]

const splitStatements = (sql) =>
  sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)

/** Load a drizzle folder's SQL statements in journal order. */
function loadFolder(folder) {
  const journal = JSON.parse(readFileSync(join(folder, "meta", "_journal.json"), "utf8"))
  return [...journal.entries]
    .sort((a, b) => a.when - b.when)
    .flatMap((e) => splitStatements(readFileSync(join(folder, `${e.tag}.sql`), "utf8")))
}

async function applyFolders(client, folders) {
  for (const folder of folders) {
    for (const stmt of loadFolder(folder)) {
      await client.query(stmt)
    }
  }
}

/** Canonical, order-independent fingerprint of the public schema. */
async function fingerprint(client) {
  const q = async (sql) => (await client.query(sql)).rows
  const columns = await q(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public'
    ORDER BY table_name, column_name`)
  const enums = await q(`
    SELECT t.typname, e.enumlabel, e.enumsortorder
    FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
    JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
    ORDER BY t.typname, e.enumsortorder`)
  const indexes = await q(`
    SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public'
    ORDER BY tablename, indexname`)
  const constraints = await q(`
    SELECT tc.table_name, tc.constraint_type, cc.column_name
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage cc
      ON cc.constraint_name=tc.constraint_name AND cc.table_schema=tc.table_schema
    WHERE tc.table_schema='public'
    ORDER BY tc.table_name, tc.constraint_type, cc.column_name`)
  return { columns, enums, indexes, constraints }
}

const hashOf = (obj) => createHash("sha256").update(JSON.stringify(obj)).digest("hex")

function urlFor(name) {
  const url = new URL(DB_URL)
  url.pathname = `/${name}`
  return url.toString()
}

async function withFreshDb(admin, name, fn) {
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  await admin.query(`CREATE DATABASE "${name}"`)
  try {
    return await fn()
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  }
}

async function onDb(name, fn) {
  const client = new Client({ connectionString: urlFor(name) })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function main() {
  const admin = new Client({ connectionString: urlFor("postgres") })
  await admin.connect()
  try {
    // Canonical current schema: drizzle-kit push of the live aggregate schema.
    const pushFp = await withFreshDb(admin, "voyant_replay_push", async () => {
      await onDb("voyant_replay_push", async (c) => {
        for (const ext of SEED_EXTENSIONS) await c.query(ext)
      })
      execFileSync("pnpm", ["exec", "drizzle-kit", "push", "--force"], {
        cwd: OPERATOR_DIR,
        stdio: "pipe",
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: urlFor("voyant_replay_push") },
      })
      return onDb("voyant_replay_push", fingerprint)
    })

    // New path: framework bundle + deployment links applied fresh.
    const newFp = await withFreshDb(admin, "voyant_replay_new", async () =>
      onDb("voyant_replay_new", async (c) => {
        await applyFolders(c, [FRAMEWORK_BUNDLE, DEPLOYMENT_LINKS])
        return fingerprint(c)
      }),
    )

    const sections = ["columns", "enums", "indexes", "constraints"]
    let ok = true
    for (const s of sections) {
      const a = hashOf(newFp[s])
      const b = hashOf(pushFp[s])
      if (a !== b) {
        ok = false
        console.error(`  MISMATCH  ${s}: new=${a.slice(0, 12)} push=${b.slice(0, 12)}`)
        const aSet = new Set(newFp[s].map((r) => JSON.stringify(r)))
        const bSet = new Set(pushFp[s].map((r) => JSON.stringify(r)))
        const onlyNew = [...aSet].filter((r) => !bSet.has(r)).slice(0, 5)
        const onlyPush = [...bSet].filter((r) => !aSet.has(r)).slice(0, 5)
        for (const r of onlyNew) console.error(`    only in bundle+links: ${r}`)
        for (const r of onlyPush) console.error(`    only in push (live):  ${r}`)
      } else {
        console.log(`  OK  ${s} (${newFp[s].length} rows)`)
      }
    }

    if (!ok) {
      console.error(
        "\nreplay-parity FAIL — the framework bundle + deployment links do NOT reconstitute the live schema.",
      )
      process.exit(1)
    }
    console.log(
      "\nverify-migration-replay-parity: OK — bundle + links == live aggregate schema (cutover-safe)",
    )
  } finally {
    await admin.end()
  }
}

main().catch((err) => {
  console.error("verify-migration-replay-parity ERROR:", err)
  process.exit(2)
})
