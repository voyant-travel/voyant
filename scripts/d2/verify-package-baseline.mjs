/**
 * D.2 slice 1 — per-package baseline equivalence (ADR Required Slice 2).
 * Proves each package's OWN migration folder reproduces EXACTLY the tables the
 * frozen framework bundle creates for it (column-for-column). This is the
 * correctness gate that lets D.2 land package-by-package: if a package baseline
 * matches the bundle for its tables, an existing D.1 DB can import-baseline it
 * safely and a fresh DB can execute it to the same schema.
 *
 * For each package P:
 *   • apply P's `migrations/` onto a throwaway DB → P's tables + columns;
 *   • assert every P table also exists in the bundle (cutline coverage);
 *   • assert P's column fingerprint == the bundle's for those same tables.
 *
 * Run: TEST_DATABASE_URL=<CREATEDB-capable Postgres> \
 *        node scripts/d2/verify-package-baseline.mjs <pkg>...
 *   (skips cleanly when no DB is configured)
 */
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

const require = createRequire(new URL("../../starters/operator/package.json", import.meta.url))
const { Client } = require("pg")

const ROOT = new URL("../..", import.meta.url).pathname
const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const pkgs = process.argv.slice(2)
if (!DB_URL) {
  console.log("verify-package-baseline: SKIP (set TEST_DATABASE_URL)")
  process.exit(0)
}
if (pkgs.length === 0) {
  console.error("usage: node scripts/d2/verify-package-baseline.mjs <pkg>...")
  process.exit(2)
}

const FRAMEWORK_BUNDLE = join(ROOT, "packages/framework-migrations/migrations")
const SEED = [
  'CREATE EXTENSION IF NOT EXISTS "pg_trgm"',
  'CREATE EXTENSION IF NOT EXISTS "unaccent"',
]

const splitStatements = (sql) =>
  sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)

function loadFolder(folder) {
  const journal = JSON.parse(readFileSync(join(folder, "meta", "_journal.json"), "utf8"))
  return [...journal.entries]
    .sort((a, b) => a.when - b.when)
    .flatMap((e) => splitStatements(readFileSync(join(folder, `${e.tag}.sql`), "utf8")))
}

const urlFor = (name) => {
  const u = new URL(DB_URL)
  u.pathname = `/${name}`
  return u.toString()
}

async function onDb(name, fn) {
  const c = new Client({ connectionString: urlFor(name) })
  await c.connect()
  try {
    return await fn(c)
  } finally {
    await c.end()
  }
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

/** table_name -> sorted column descriptor list. */
async function columnsByTable(client) {
  const r = await client.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public'
    ORDER BY table_name, column_name`)
  const m = new Map()
  for (const row of r.rows) {
    if (!m.has(row.table_name)) m.set(row.table_name, [])
    m.get(row.table_name).push(row)
  }
  return m
}

async function applyFolder(client, folder) {
  for (const s of SEED) await client.query(s)
  for (const stmt of loadFolder(folder)) await client.query(stmt)
}

async function main() {
  const admin = new Client({ connectionString: urlFor("postgres") })
  await admin.connect()
  let failed = 0
  try {
    // Bundle truth (once).
    const bundleCols = await withFreshDb(admin, "d2_verify_bundle", async () => {
      await onDb("d2_verify_bundle", (c) => applyFolder(c, FRAMEWORK_BUNDLE))
      return onDb("d2_verify_bundle", columnsByTable)
    })

    for (const name of pkgs) {
      const folder = join(ROOT, "packages", name, "migrations")
      const dbName = `d2_verify_${name.replace(/[^a-z0-9]/g, "_")}`
      const pkgCols = await withFreshDb(admin, dbName, async () => {
        await onDb(dbName, (c) => applyFolder(c, folder))
        return onDb(dbName, columnsByTable)
      })

      const problems = []
      for (const [table, cols] of pkgCols) {
        const bundle = bundleCols.get(table)
        if (!bundle) {
          problems.push(`table ${table} not in framework bundle (cutline gap)`)
          continue
        }
        if (JSON.stringify(cols) !== JSON.stringify(bundle)) {
          problems.push(`table ${table} columns differ from the bundle`)
        }
      }
      if (problems.length === 0) {
        console.log(`  PASS  ${name} — ${pkgCols.size} table(s) match the bundle column-for-column`)
      } else {
        failed++
        console.log(`  FAIL  ${name}`)
        for (const p of problems.slice(0, 8)) console.log(`          • ${p}`)
      }
    }
  } finally {
    await admin.end()
  }
  console.log(
    `\n${failed === 0 ? "VERIFY PASS" : "VERIFY FAIL"} — ${pkgs.length - failed}/${pkgs.length} packages`,
  )
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("verify-package-baseline ERROR:", e)
  process.exit(2)
})
