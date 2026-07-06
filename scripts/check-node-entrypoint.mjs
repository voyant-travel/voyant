/**
 * Validates the operator's Node runtime entrypoints (voyant#2966).
 *
 *  1. `src/server.ts` (the Node process entry) exists and boots the runtime via
 *     `createNodeServer` from `@voyant-travel/runtime`.
 *  2. `src/entry.ts` (the app's `fetch`/`scheduled` handlers) keeps SSR behind a
 *     lazy import so the React + react-dom/server graph isn't pulled into the
 *     module's top-level — imported on first render, not at boot. Heavy API and
 *     workflow graphs stay lazy for the same reason.
 *
 * See docs/architecture/deployment-targets.md for the rule.
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const APP_ENTRY = "starters/operator/src/entry.ts"
const NODE_ENTRY = "starters/operator/src/server.ts"

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
      "react-dom/server (~2.2 MB) into the module graph. Wrap it in ./ssr-handler " +
      "and load it with lazySsr behind the non-API branch.",
  },
  {
    id: "eager-ssr-handler",
    pattern: /^import\s+(?:.+?\s+from\s+)?["']\.\/ssr-handler(?:\.js)?["']/,
    message: "Load ./ssr-handler with lazySsr (dynamic import), never statically.",
  },
]

const violations = []

// 1. App entry: keep SSR / API / workflow graphs lazy.
const appLines = readFileSync(join(ROOT, APP_ENTRY), "utf-8").split("\n")
for (let i = 0; i < appLines.length; i++) {
  const text = (appLines[i] ?? "").trim()
  for (const check of FORBIDDEN_IMPORTS) {
    if (check.pattern.test(text)) {
      violations.push({ file: APP_ENTRY, line: i + 1, check, text })
    }
  }
}

// 2. Node entry: must exist and wire createNodeServer.
if (!existsSync(join(ROOT, NODE_ENTRY))) {
  violations.push({
    file: NODE_ENTRY,
    line: 0,
    check: { id: "missing-node-entry", message: "The Node process entry is missing." },
    text: "",
  })
} else if (!readFileSync(join(ROOT, NODE_ENTRY), "utf-8").includes("createNodeServer")) {
  violations.push({
    file: NODE_ENTRY,
    line: 0,
    check: {
      id: "node-entry-not-wired",
      message: "The Node entry must boot the runtime via createNodeServer.",
    },
    text: "",
  })
}

if (violations.length > 0) {
  console.error("Node entrypoint violation.")
  console.error("See docs/architecture/deployment-targets.md for the rule.\n")
  for (const violation of violations) {
    const at = violation.line > 0 ? `:${violation.line}` : ""
    console.error(`  ${violation.file}${at} (${violation.check.id})`)
    if (violation.text) console.error(`    ${violation.text}`)
    console.error(`    ${violation.check.message}`)
  }
  process.exit(1)
}

console.log("check-node-entrypoint: OK (app entry lazy; server.ts wires createNodeServer)")
