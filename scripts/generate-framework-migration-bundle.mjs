/**
 * Generates / verifies the D.1 standard-profile aggregate migration bundle
 * shipped by `@voyant-travel/framework-migrations`.
 * RFC: docs/architecture/consolidated-deployments-rfc.md (Workstream D.1);
 * ADR: docs/architecture/migration-collector-d1.md.
 *
 * The bundle is a drizzle migrations folder generated from the operator
 * reference profile's package-owned schemas (the standard profile), MINUS the
 * deployment-local cross-module link tables (those stay a *deployment*
 * migration source). It is INCREMENTAL: `0000_framework_baseline` is frozen;
 * a standard-schema change appends `0001…` — never rewrites `0000` (a changed
 * content-hash would trip the collector's immutability guard).
 *
 *   default       : check — fails if the committed bundle is stale (a standard
 *                   schema changed without regenerating). Restores the tree.
 *   --emit        : generate (append a new migration if the schema changed),
 *                   leaving the result to commit.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const BUNDLE_DIR = "packages/framework-migrations/migrations"
const BASELINE = join(ROOT, BUNDLE_DIR, "0000_framework_baseline.sql")
const EMIT = process.argv.includes("--emit")

// Postgres extensions the standard schema's indexes need (e.g. trigram /
// unaccent search). drizzle-kit only auto-generates `postgis`, so the baseline
// gets this preamble injected. Idempotent — added only if not already present.
const EXTENSIONS_PREAMBLE = [
  'CREATE EXTENSION IF NOT EXISTS "pg_trgm";',
  'CREATE EXTENSION IF NOT EXISTS "unaccent";',
]
const PREAMBLE_MARK = EXTENSIONS_PREAMBLE[0]

function ensureExtensionsPreamble() {
  if (!existsSync(BASELINE)) return
  const sql = readFileSync(BASELINE, "utf8")
  if (sql.includes(PREAMBLE_MARK)) return
  const preamble = `${EXTENSIONS_PREAMBLE.join("\n--> statement-breakpoint\n")}\n--> statement-breakpoint\n`
  writeFileSync(BASELINE, preamble + sql)
}

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: "pipe", ...opts })

function bundleStatus() {
  // Porcelain status limited to the bundle dir — empty = in sync.
  return run("git", ["status", "--porcelain", "--", BUNDLE_DIR]).trim()
}

const before = bundleStatus()
if (before && !EMIT) {
  console.error(
    `framework-migration-bundle: ${BUNDLE_DIR} has uncommitted changes before the check — ` +
      "commit or stash them first.",
  )
  process.exit(1)
}

// drizzle-kit runs from the operator dir (its schema paths + deps resolve there);
// the reference config writes into the bundle dir. `--name` only takes effect for
// the first (baseline) migration; later runs auto-name the diff.
run(
  "pnpm",
  [
    "-C",
    "starters/operator",
    "exec",
    "drizzle-kit",
    "generate",
    "--config=drizzle.framework-bundle.config.ts",
    "--name=framework_baseline",
  ],
  { stdio: "inherit" },
)

// drizzle-kit can't emit `CREATE EXTENSION` for pg_trgm/unaccent — inject them.
ensureExtensionsPreamble()

const after = bundleStatus()

if (EMIT) {
  console.log(
    after
      ? "generate-framework-migration-bundle: emitted bundle changes — review + commit."
      : "generate-framework-migration-bundle: bundle already up to date.",
  )
  process.exit(0)
}

if (after) {
  console.error(
    "framework-migration-bundle drift — the standard-profile schema changed without " +
      "regenerating the bundle. Run `node scripts/generate-framework-migration-bundle.mjs --emit` " +
      "and commit the new migration:",
  )
  console.error(after)
  // Leave the tree as the dev left it: drop the just-generated artifacts.
  run("git", ["checkout", "--", BUNDLE_DIR])
  run("git", ["clean", "-fd", "--", BUNDLE_DIR])
  process.exit(1)
}

console.log("check-framework-migration-bundle: OK (bundle in sync with the standard-profile schema)")
