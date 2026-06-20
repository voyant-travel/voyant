/**
 * D.2 generation post-step — ensure required Postgres EXTENSIONS exist.
 *
 * drizzle-kit does not emit `CREATE EXTENSION`, and the retired framework bundle
 * injected a `pg_trgm` + `unaccent` preamble that the per-package sources lack.
 * On a fresh D.2 database (bundle decommissioned), the first `gin_trgm_ops`
 * index fails unless an earlier source already created `pg_trgm`.
 *
 * Extensions are infrastructure, so `@voyant-travel/db` owns them: every package
 * `requiresSchemas` db, and db is applied first in every closure, so the
 * extensions exist before any downstream trigram/unaccent index. This prepends
 * idempotent `CREATE EXTENSION IF NOT EXISTS` to db's baseline (no-op if already
 * present, so re-running is safe).
 *
 * Usage: node scripts/d2/ensure-extensions.mjs <migrations-dir> [ext...]
 *        (default exts: pg_trgm unaccent)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const dir = process.argv[2]
if (!dir) {
  console.error("usage: node scripts/d2/ensure-extensions.mjs <migrations-dir> [ext...]")
  process.exit(2)
}
const exts = process.argv.slice(3)
if (exts.length === 0) exts.push("pg_trgm", "unaccent")

// The baseline is the lexically-first migration file.
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
if (files.length === 0) {
  console.error(`ensure-extensions: no .sql files in ${dir}`)
  process.exit(2)
}
const path = join(dir, files[0])
let sql = readFileSync(path, "utf8")

const missing = exts.filter((e) => !sql.includes(`CREATE EXTENSION IF NOT EXISTS "${e}"`))
if (missing.length === 0) {
  console.log(`ensure-extensions: ${exts.join(", ")} already present in ${files[0]}`)
  process.exit(0)
}

const preamble = `${missing.map((e) => `CREATE EXTENSION IF NOT EXISTS "${e}";`).join("\n--> statement-breakpoint\n")}\n--> statement-breakpoint\n`
sql = preamble + sql
writeFileSync(path, sql)
console.log(`ensure-extensions: prepended ${missing.join(", ")} to ${files[0]}`)
