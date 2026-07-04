/**
 * Keeps Cloudflare SSR Worker entrypoints thin enough for Worker startup
 * validation. Heavy API apps, scheduled jobs, and workflow definitions must
 * be lazy-loaded from their route/event branch instead of imported at module
 * startup.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const ENTRYPOINTS = ["starters/operator/src/entry.ts"]

const FORBIDDEN_IMPORTS = [
  {
    id: "eager-api-app",
    pattern: /^import\s+(?:.+?\s+from\s+)?["']\.\/api(?:\/|["'])/,
    message: "Lazy-load API modules behind the /api/* branch.",
  },
  {
    id: "eager-workflows",
    pattern: /^import\s+(?:.+?\s+from\s+)?["']\.\/workflows(?:\.js)?["']/,
    message: "Lazy-load workflow definitions from the workflow step path.",
  },
  {
    id: "eager-ssr-server",
    pattern: /^import\s+(?:.+?\s+from\s+)?["']@tanstack\/react-start\/server["']/,
    message:
      "Statically importing the TanStack Start server handler pulls React + " +
      "react-dom/server (~2.2 MB) into startup. Wrap it in ./ssr-handler and " +
      "load it with lazySsr behind the non-API branch.",
  },
  {
    id: "eager-ssr-handler",
    pattern: /^import\s+(?:.+?\s+from\s+)?["']\.\/ssr-handler(?:\.js)?["']/,
    message: "Load ./ssr-handler with lazySsr (dynamic import), never statically.",
  },
]

const violations = []

for (const entrypoint of ENTRYPOINTS) {
  const lines = readFileSync(join(ROOT, entrypoint), "utf-8").split("\n")
  for (let i = 0; i < lines.length; i++) {
    const text = (lines[i] ?? "").trim()
    for (const check of FORBIDDEN_IMPORTS) {
      if (!check.pattern.test(text)) continue
      violations.push({
        file: entrypoint,
        line: i + 1,
        check,
        text,
      })
    }
  }
}

if (violations.length > 0) {
  console.error("Cloudflare entrypoint violation: eager startup imports found.")
  console.error("See docs/architecture/cloudflare-worker-entrypoints.md for the rule.\n")
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line} (${violation.check.id})`)
    console.error(`    ${violation.text}`)
    console.error(`    ${violation.check.message}`)
  }
  process.exit(1)
}

console.log(`check-cloudflare-entrypoints: OK (scanned ${ENTRYPOINTS.length} entrypoints)`)
