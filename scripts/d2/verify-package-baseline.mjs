/**
 * D.2 slice 1 — per-package baseline equivalence (ADR Required Slice 2).
 * Proves each package's OWN migration folder reproduces EXACTLY the tables the
 * frozen framework bundle creates for it (column-for-column). This is the
 * correctness gate that lets D.2 land package-by-package: if a package baseline
 * matches the bundle for its tables, an existing D.1 DB can import-baseline it
 * safely and a fresh DB can execute it to the same schema.
 *
 * CLOSURE-AWARE: a package may FK into its `voyant.requiresSchemas` dependencies
 * (including @voyant-travel/db), so it cannot apply in isolation. For each target
 * P we apply P's dependency closure first (deps-first topo order, from the
 * generated package folders) THEN P, and compare ONLY the tables P itself
 * creates against the bundle.
 *
 * Run: TEST_DATABASE_URL=<CREATEDB-capable Postgres> \
 *        node scripts/d2/verify-package-baseline.mjs <pkg-dir>...
 *   (skips cleanly when no DB is configured)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
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
  console.error("usage: node scripts/d2/verify-package-baseline.mjs <pkg-dir>...")
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

/** name -> { dir, name, requires, migrationsDir, hasMigrations }. */
function buildManifests() {
  const byName = new Map()
  for (const dir of readdirSync(join(ROOT, "packages"))) {
    const pjPath = join(ROOT, "packages", dir, "package.json")
    if (!existsSync(pjPath)) continue
    const pj = JSON.parse(readFileSync(pjPath, "utf8"))
    const migrationsDir = join(ROOT, "packages", dir, "migrations")
    byName.set(pj.name, {
      dir,
      name: pj.name,
      requires: pj.voyant?.requiresSchemas ?? [],
      migrationsDir,
      hasMigrations: existsSync(join(migrationsDir, "meta", "_journal.json")),
    })
  }
  return byName
}

/** Deps-first topo closure for `name`, limited to packages that ship migrations. */
function closure(name, manifests, out = [], seen = new Set()) {
  if (seen.has(name)) return out
  seen.add(name)
  const m = manifests.get(name)
  if (!m) return out
  for (const dep of m.requires) closure(dep, manifests, out, seen)
  if (m.hasMigrations) out.push(m)
  return out
}

/** Tables a package's own migration folder CREATEs. */
function ownTables(migrationsDir) {
  const set = new Set()
  for (const stmt of loadFolder(migrationsDir)) {
    const m = stmt.match(/^CREATE TABLE (?:IF NOT EXISTS )?"([a-z0-9_]+)"/i)
    if (m) set.add(m[1])
  }
  return set
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

async function main() {
  const manifests = buildManifests()
  const byDir = new Map([...manifests.values()].map((m) => [m.dir, m]))
  const admin = new Client({ connectionString: urlFor("postgres") })
  await admin.connect()
  let failed = 0
  try {
    const bundleCols = await withFreshDb(admin, "d2_verify_bundle", async () => {
      await onDb("d2_verify_bundle", async (c) => {
        for (const s of SEED) await c.query(s)
        for (const stmt of loadFolder(FRAMEWORK_BUNDLE)) await c.query(stmt)
      })
      return onDb("d2_verify_bundle", columnsByTable)
    })

    for (const dir of pkgs) {
      const target = byDir.get(dir)
      if (!target?.hasMigrations) {
        failed++
        console.log(`  FAIL  ${dir} — no generated migrations folder`)
        continue
      }
      const order = closure(target.name, manifests) // deps first, target last
      const dbName = `d2_verify_${dir.replace(/[^a-z0-9]/g, "_")}`
      const cols = await withFreshDb(admin, dbName, async () => {
        await onDb(dbName, async (c) => {
          for (const s of SEED) await c.query(s)
          for (const m of order) for (const stmt of loadFolder(m.migrationsDir)) await c.query(stmt)
        })
        return onDb(dbName, columnsByTable)
      })

      const own = ownTables(target.migrationsDir)
      const problems = []
      for (const table of own) {
        const got = cols.get(table)
        const want = bundleCols.get(table)
        if (!want) problems.push(`table ${table} not in framework bundle (cutline gap)`)
        else if (JSON.stringify(got) !== JSON.stringify(want))
          problems.push(`table ${table} columns differ from the bundle`)
      }
      const deps = order.length - 1
      if (problems.length === 0) {
        console.log(
          `  PASS  ${dir} — ${own.size} table(s) match the bundle column-for-column` +
            (deps > 0 ? ` (closure: ${deps} dep folder(s))` : ""),
        )
      } else {
        failed++
        console.log(`  FAIL  ${dir}`)
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
