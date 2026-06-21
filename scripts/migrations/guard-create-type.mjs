/**
 * D.2 generation post-step — make `CREATE TYPE … AS ENUM(…)` idempotent.
 *
 * The codebase deliberately INLINES copies of shared enums to avoid cross-package
 * schema imports (e.g. `service_type` in both distribution and inventory,
 * `entity_type` in both relationships and quotes). The monolithic framework
 * bundle dedupes these (one CREATE TYPE); per-package generation does not — each
 * owner emits its own CREATE TYPE, so a fresh D.2 database that applies both
 * package sources fails with `duplicate_object`.
 *
 * Wrapping each CREATE TYPE in a DO block that swallows `duplicate_object` makes
 * the statement a no-op when the type already exists — subset-safe (whichever
 * package applies first creates it; the rest skip) and forward-safe (new shared
 * enums are handled automatically). Re-running is a no-op: an already-wrapped
 * statement is indented inside the DO block and no longer matches.
 *
 * Drizzle diffs against its snapshot JSON, not this SQL, so the wrapper is
 * invisible to future `db:generate` runs.
 *
 * Usage: node scripts/migrations/guard-create-type.mjs <migrations-dir>
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const dir = process.argv[2]
if (!dir) {
  console.error("usage: node scripts/migrations/guard-create-type.mjs <migrations-dir>")
  process.exit(2)
}

// Match a top-of-line drizzle `CREATE TYPE "schema"."name" AS ENUM(...);`
const CREATE_TYPE = /^CREATE TYPE ("[a-z_]+"\."[a-z_]+") AS ENUM\(([^;]*)\);/gm

let wrapped = 0
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
  const path = join(dir, file)
  const before = readFileSync(path, "utf8")
  const after = before.replace(CREATE_TYPE, (_m, name, body) => {
    wrapped++
    return `DO $$ BEGIN\n CREATE TYPE ${name} AS ENUM(${body});\nEXCEPTION WHEN duplicate_object THEN null;\nEND $$;`
  })
  if (after !== before) writeFileSync(path, after)
}

console.log(`guard-create-type: wrapped ${wrapped} CREATE TYPE statement(s) in ${dir}`)
