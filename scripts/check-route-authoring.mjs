/**
 * Enforces the route parsing rules from docs/architecture/api-route-authoring.md.
 *
 * New Hono routes should parse request bodies through parseJsonBody(...) and query
 * strings through parseQuery(...).
 * so the check prevents new drift without making this process branch own that
 * cleanup.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const PACKAGES_DIR = join(ROOT, "packages")

const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", ".next", "coverage"])

const ALLOWED_EXISTING = new Set([
  // @voyant-travel/storage cannot import parseJsonBody from @voyant-travel/hono
  // (hono imports StorageProvider from storage — that would cycle), so the media
  // upload route inlines an equivalent json + zod safeParse that returns 400.
  "packages/storage/src/routes.ts|raw-json|raw = await c.req.json()",
])

const CHECKS = [
  {
    id: "raw-json",
    pattern: /\bc\.req\.json\s*\(/,
    message: "Use parseJsonBody(c, schema) instead of c.req.json().",
  },
  {
    id: "raw-query",
    pattern: /new URL\(c\.req\.url\)\.searchParams/,
    message: "Use parseQuery(c, schema) instead of manually reading searchParams.",
  },
]

function* walkRouteFiles(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      yield* walkRouteFiles(full)
    } else if (stats.isFile() && /^routes.*\.ts$/.test(entry)) {
      yield full
    }
  }
}

const violations = []

for (const file of walkRouteFiles(PACKAGES_DIR)) {
  const relativeFile = relative(ROOT, file)
  const lines = readFileSync(file, "utf-8").split("\n")

  for (let i = 0; i < lines.length; i++) {
    const text = (lines[i] ?? "").trim()
    for (const check of CHECKS) {
      if (!check.pattern.test(text)) continue
      const key = `${relativeFile}|${check.id}|${text}`
      if (!ALLOWED_EXISTING.has(key)) {
        violations.push({ file: relativeFile, line: i + 1, check, text })
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Route authoring violation: raw route parsing found in package routes.")
  console.error("See docs/architecture/api-route-authoring.md for the route parsing rules.\n")
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line} (${violation.check.id})`)
    console.error(`    ${violation.text}`)
    console.error(`    ${violation.check.message}`)
  }
  console.error(
    "\nIf this is intentional legacy debt, either migrate it now or baseline the exact existing line with a comment explaining why.",
  )
  process.exit(1)
}

console.log(`check-route-authoring: OK (scanned ${PACKAGES_DIR})`)
