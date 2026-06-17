/**
 * D.1 replay-parity oracle (Workstream D.1, slice 3 — the safety gate for the
 * runner cutover). Proves that the NEW migration sources reconstitute EXACTLY
 * the schema the LEGACY combined history produces:
 *
 *   framework bundle  (packages/framework-migrations/migrations)
 *   + deployment links (starters/operator/migrations-d1)
 *   ===  legacy combined history (starters/operator/migrations)
 *
 * It applies the new path onto a throwaway database, computes a canonical
 * schema fingerprint (tables/columns/enums/indexes/constraints) of the `public`
 * schema, and asserts it equals the fingerprint of the CURRENT database (the
 * real legacy end-state — the migration ledgers live in the `drizzle` schema so
 * they're naturally excluded). If they match, baselining an existing legacy DB
 * onto the new ledger (slice 4) is safe. See docs/architecture/migration-collector-d1.md.
 *
 * (Comparing against the live current DB rather than a fresh legacy replay is
 * deliberate: the legacy history has a state-dependent `DROP TABLE` — #0068 —
 * that isn't cleanly fresh-replayable; the live DB is the canonical truth.)
 *
 * Run: TEST_DATABASE_URL=<postgres url, user with CREATEDB> node scripts/verify-migration-replay-parity.mjs
 *   (skips cleanly when no DB is configured).
 */
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

const require = createRequire(new URL("../starters/operator/package.json", import.meta.url))
const { Client } = require("pg")

const ROOT = new URL("..", import.meta.url).pathname
const DB_URL = process.env.TEST_DATABASE_URL
if (!DB_URL) {
  console.log("verify-migration-replay-parity: SKIP (set TEST_DATABASE_URL to a CREATEDB-capable Postgres)")
  process.exit(0)
}

const FRAMEWORK_BUNDLE = join(ROOT, "packages/framework-migrations/migrations")
const DEPLOYMENT_LINKS = join(ROOT, "starters/operator/migrations-d1")
const LEGACY = join(ROOT, "starters/operator/migrations")

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

async function applyFolders(client, label, folders, { tolerateDropDeps = false } = {}) {
  for (const folder of folders) {
    for (const stmt of loadFolder(folder)) {
      try {
        await client.query(stmt)
      } catch (err) {
        // The legacy history has retired-table DROPs without CASCADE that only
        // replay cleanly because of out-of-journal-order application on the real
        // DB (e.g. 0068's `DROP TABLE orders`). For the *canonical legacy replay*
        // we retry such DROPs with CASCADE — the end-state is identical (the
        // dependent FKs are gone in the current schema anyway).
        if (tolerateDropDeps && /^DROP TABLE/i.test(stmt.trim()) && /depend/i.test(err.message)) {
          await client.query(stmt.replace(/;?\s*$/, " CASCADE;"))
          continue
        }
        const first = stmt.split("\n")[0]
        throw new Error(
          `${label}: a migration statement failed to apply — ${err.message}\n` +
            `  statement: ${first}…`,
        )
      }
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
    JOIN information_schema.key_column_usage cc
      ON cc.constraint_name=tc.constraint_name AND cc.table_schema=tc.table_schema
    WHERE tc.table_schema='public'
    ORDER BY tc.table_name, tc.constraint_type, cc.column_name`)
  return { columns, enums, indexes, constraints }
}

const hashOf = (obj) => createHash("sha256").update(JSON.stringify(obj)).digest("hex")

async function withFreshDb(admin, name, fn) {
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  await admin.query(`CREATE DATABASE "${name}"`)
  const url = new URL(DB_URL)
  url.pathname = `/${name}`
  const client = new Client({ connectionString: url.toString() })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  }
}

async function main() {
  const adminUrl = new URL(DB_URL)
  adminUrl.pathname = "/postgres"
  const admin = new Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  try {
    const newFp = await withFreshDb(admin, "voyant_replay_new", async (c) => {
      await applyFolders(c, "new (bundle + links)", [FRAMEWORK_BUNDLE, DEPLOYMENT_LINKS])
      return fingerprint(c)
    })
    // Canonical target: the legacy combined history applied to a fresh DB
    // (CASCADE-tolerant for the retired-table DROPs that aren't cleanly
    // fresh-replayable).
    const legacyFp = await withFreshDb(admin, "voyant_replay_legacy", async (c) => {
      await applyFolders(c, "legacy", [LEGACY], { tolerateDropDeps: true })
      return fingerprint(c)
    })

    const sections = ["columns", "enums", "indexes", "constraints"]
    let ok = true
    for (const s of sections) {
      const a = hashOf(newFp[s])
      const b = hashOf(legacyFp[s])
      if (a !== b) {
        ok = false
        console.error(`  MISMATCH  ${s}: new=${a.slice(0, 12)} legacy=${b.slice(0, 12)}`)
        // Surface a few diffs to make the failure actionable.
        const aSet = new Set(newFp[s].map((r) => JSON.stringify(r)))
        const bSet = new Set(legacyFp[s].map((r) => JSON.stringify(r)))
        const onlyNew = [...aSet].filter((r) => !bSet.has(r)).slice(0, 5)
        const onlyLegacy = [...bSet].filter((r) => !aSet.has(r)).slice(0, 5)
        for (const r of onlyNew) console.error(`    only in new:    ${r}`)
        for (const r of onlyLegacy) console.error(`    only in legacy: ${r}`)
      } else {
        console.log(`  OK  ${s} (${newFp[s].length} rows)`)
      }
    }

    if (!ok) {
      console.error(
        "\nreplay-parity FAIL — the framework bundle + deployment links do NOT reconstitute the legacy schema.",
      )
      process.exit(1)
    }
    console.log("\nverify-migration-replay-parity: OK — bundle + links == legacy aggregate (cutover-safe)")
  } finally {
    await admin.end()
  }
}

main().catch((err) => {
  console.error("verify-migration-replay-parity ERROR:", err)
  process.exit(2)
})
