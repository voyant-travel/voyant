/**
 * Validates the operator's Node runtime entrypoints (voyant#2966).
 *
 *  1. `src/server.ts` (the Node process entry) exists and boots the runtime via
 *     `createNodeServer` from `@voyant-travel/runtime`.
 *  1b. `src/server.ts` consumes the checked deployment graph artifacts and
 *      asserts graph resource env before standalone boot so dev/build/deploy
 *      share the same graph contract.
 *  1c. the operator dev and migration lanes preflight the same graph contract
 *      before serving traffic or touching the database.
 *  1d. provider bindings are selected from graph-declared providers, not
 *      incidental env var presence.
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
const OPERATOR_PACKAGE_JSON = "starters/operator/package.json"
const GENERATED_RUNTIME_ENTRY = "runtime-entry.generated"

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
} else {
  const nodeEntrySource = readFileSync(join(ROOT, NODE_ENTRY), "utf-8")
  if (!nodeEntrySource.includes("createNodeServer")) {
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
  if (
    !nodeEntrySource.includes('from "./deployment-graph-artifacts"') ||
    !nodeEntrySource.includes("loadDeploymentGraphArtifacts") ||
    !/^const\s+\w+\s*=\s*loadDeploymentGraphArtifacts\(\s*\)/m.test(nodeEntrySource)
  ) {
    violations.push({
      file: NODE_ENTRY,
      line: 0,
      check: {
        id: "deployment-graph-artifacts-not-consumed",
        message: "The Node entry must validate deployment graph artifacts at boot.",
      },
      text: "",
    })
  }
  if (
    !nodeEntrySource.includes("assertVoyantNodeDeploymentGraphResourceEnv") ||
    !/assertVoyantNodeDeploymentGraphResourceEnv\(\s*\w+\s*,\s*process\.env\s*\)/m.test(
      nodeEntrySource,
    )
  ) {
    violations.push({
      file: NODE_ENTRY,
      line: 0,
      check: {
        id: "deployment-graph-resource-env-not-asserted",
        message: "The Node entry must assert graph resource env before standalone boot.",
      },
      text: "",
    })
  }
  if (nodeEntrySource.includes(GENERATED_RUNTIME_ENTRY)) {
    violations.push({
      file: NODE_ENTRY,
      line: 0,
      check: {
        id: "deployment-runtime-entry-imported",
        message:
          "The Node entry must validate deployment graph artifacts without importing the generated runtime entry.",
      },
      text: "",
    })
  }
  if (
    !nodeEntrySource.includes('from "@voyant-travel/framework/node-host"') ||
    !nodeEntrySource.includes("resolveVoyantNodeProviderPlan") ||
    !nodeEntrySource.includes("deploymentGraphArtifacts.providers") ||
    !/^const\s+\w+\s*=\s*resolveVoyantNodeProviderPlan\(\s*deploymentGraphArtifacts\.providers\s*\)/m.test(
      nodeEntrySource,
    )
  ) {
    violations.push({
      file: NODE_ENTRY,
      line: 0,
      check: {
        id: "deployment-graph-providers-not-consumed",
        message: "The Node entry must select runtime providers from deployment graph providers.",
      },
      text: "",
    })
  }
  if (
    !nodeEntrySource.includes("validateVoyantNodeProviderPlanEnv") ||
    !nodeEntrySource.includes("assertVoyantNodeProviderPlanEnv")
  ) {
    violations.push({
      file: NODE_ENTRY,
      line: 0,
      check: {
        id: "deployment-provider-plan-env-not-asserted",
        message: "The Node entry must assert graph-selected provider env before binding providers.",
      },
      text: "",
    })
  }
}

// 3. Project commands must delegate graph operations to generic tooling.
if (!existsSync(join(ROOT, OPERATOR_PACKAGE_JSON))) {
  violations.push({
    file: OPERATOR_PACKAGE_JSON,
    line: 0,
    check: {
      id: "missing-operator-package-json",
      message: "The operator package manifest is missing.",
    },
    text: "",
  })
} else {
  const packageJson = JSON.parse(readFileSync(join(ROOT, OPERATOR_PACKAGE_JSON), "utf-8"))
  const scripts =
    packageJson.scripts && typeof packageJson.scripts === "object" ? packageJson.scripts : {}
  const migrateScript = typeof scripts["db:migrate"] === "string" ? scripts["db:migrate"] : ""
  if (!migrateScript.includes("pnpm run graph:emit") || !/\bvoyant migrate\b/.test(migrateScript)) {
    violations.push({
      file: OPERATOR_PACKAGE_JSON,
      line: 0,
      check: {
        id: "operator-migrate-graph-check-missing",
        message:
          "The operator db:migrate script must generate artifacts and delegate to voyant migrate.",
      },
      text: migrateScript,
    })
  }
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

console.log(
  "check-node-entrypoint: OK (app entry lazy; server.ts validates graph resources; migrations delegate to the graph-native CLI)",
)
