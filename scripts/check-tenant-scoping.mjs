/**
 * Enforces ADR-0001: tenant scoping is enforced at the deployment boundary,
 * NOT by in-process middleware. Fails CI if forbidden patterns appear in
 * framework code (`packages/`).
 *
 * Templates and apps may legitimately reference org-scoping concerns
 * (e.g. for organisation-aware UI within a single-tenant deployment),
 * so they're scoped out.
 *
 * If you intentionally introduce tenant-scoping middleware, you are
 * proposing to revisit ADR-0001; do that explicitly, not by adding to this
 * allowlist.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const PACKAGES_DIR = join(ROOT, "packages")

const FORBIDDEN_PATTERNS = [
  /\brequireOrgId\b/,
  /\borgScopedDb\b/,
  /\bcreateOrgScopedDbClient\b/,
  /\btenantScopedDb\b/,
]

const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", ".next", "coverage"])

function* walkTs(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      yield* walkTs(full)
    } else if (stats.isFile() && /\.(ts|tsx)$/.test(entry)) {
      yield full
    }
  }
}

const violations = []

for (const file of walkTs(PACKAGES_DIR)) {
  const lines = readFileSync(file, "utf-8").split("\n")
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? ""
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) {
        violations.push({ file: relative(ROOT, file), line: i + 1, pattern, text: text.trim() })
      }
    }
  }
}

if (violations.length > 0) {
  console.error("ADR-0001 violation: in-process tenant-scoping symbols found in framework code.")
  console.error("See docs/adr/0001-tenant-scoping.md for context.\n")
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} (matched ${v.pattern.source})`)
    console.error(`    ${v.text}`)
  }
  console.error(
    "\nIf you are proposing to revisit ADR-0001, do so explicitly in a follow-up ADR; do not add to this script's allowlist.",
  )
  process.exit(1)
}

console.log(`check-tenant-scoping: OK (scanned ${PACKAGES_DIR})`)
