/**
 * D.2 slice 3 — generate/verify the BASELINE CUTLINE manifest.
 * ADR: docs/architecture/migration-collector-d2.md (Decision 5).
 *
 * The cutline records, per package source, which migration tags the retired
 * framework bundle already materialised. On an existing D.1 database the D.2
 * collector IMPORT-BASELINES these (records them as applied without executing —
 * the tables already exist) and EXECUTES anything after the cutline. By the
 * fresh-D.2 union proof (bundle == the union of all current package baselines),
 * the cutline at cutover is exactly every package's current migration tags.
 *
 * This is committed data (regenerated as more packages/migrations land before
 * the bundle is decommissioned), keyed by package directory name — the migration
 * source name the collector uses.
 *
 *   default : check — fail if the committed manifest is stale. (CI gate.)
 *   --emit  : (re)write the manifest, leaving the result to commit.
 *
 * Run: node scripts/d2/generate-cutline.mjs [--emit]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = new URL("../..", import.meta.url).pathname
const MANIFEST = join(ROOT, "packages/framework-migrations/cutline.generated.json")
const EMIT = process.argv.includes("--emit")

/** package-dir -> ordered migration tags (journal order), for every package
 *  that ships a migrations folder (the framework bundle itself is excluded). */
function buildCutline() {
  const cutline = {}
  for (const dir of readdirSync(join(ROOT, "packages")).sort()) {
    if (dir === "framework-migrations") continue
    const journalPath = join(ROOT, "packages", dir, "migrations", "meta", "_journal.json")
    if (!existsSync(journalPath)) continue
    const journal = JSON.parse(readFileSync(journalPath, "utf8"))
    cutline[dir] = [...journal.entries].sort((a, b) => a.when - b.when).map((e) => e.tag)
  }
  return cutline
}

const cutline = buildCutline()
const serialized = `${JSON.stringify({ cutline }, null, 2)}\n`

if (EMIT) {
  writeFileSync(MANIFEST, serialized)
  const total = Object.values(cutline).reduce((n, tags) => n + tags.length, 0)
  console.log(
    `generate-cutline: emitted ${Object.keys(cutline).length} package(s), ${total} tag(s) to cutline.generated.json`,
  )
  process.exit(0)
}

if (!existsSync(MANIFEST)) {
  console.error(
    "cutline manifest missing — run `node scripts/d2/generate-cutline.mjs --emit` and commit it.",
  )
  process.exit(1)
}
// Compare PARSED content (formatting-agnostic — the committed file may be
// reformatted by biome, which must not trip the drift gate).
const committed = JSON.parse(readFileSync(MANIFEST, "utf8")).cutline ?? {}
if (JSON.stringify(committed) !== JSON.stringify(cutline)) {
  console.error(
    "cutline drift — package migration tags changed without regenerating the cutline. " +
      "Run `node scripts/d2/generate-cutline.mjs --emit` and commit:",
  )
  for (const pkg of new Set([...Object.keys(cutline), ...Object.keys(committed)])) {
    const now = (cutline[pkg] ?? []).join(",")
    const was = (committed[pkg] ?? []).join(",")
    if (now !== was) console.error(`  ${pkg}: committed [${was}] -> current [${now}]`)
  }
  process.exit(1)
}
console.log(
  `check-cutline: OK (${Object.keys(cutline).length} package sources in sync with their migration tags)`,
)
