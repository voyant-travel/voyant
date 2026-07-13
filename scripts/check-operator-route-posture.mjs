import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const APP = optionPath("--app", join(ROOT, "starters/operator/src/api/app.ts"))
const COMPOSITION = optionPath(
  "--composition",
  join(ROOT, "starters/operator/src/api/runtime/operator-runtime-adapter.ts"),
)
const LEGACY_PUBLIC_PATHS = optionPath(
  "--legacy-public-paths",
  join(ROOT, "starters/operator/src/api/public-paths.ts"),
)

function optionPath(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value) throw new Error(`${name} requires a path`)
  return value
}

function readRequired(path) {
  if (!existsSync(path)) throw new Error(`check-operator-route-posture: missing ${path}`)
  return readFileSync(path, "utf8")
}

const app = readRequired(APP)
const composition = readRequired(COMPOSITION)
const violations = []

if (existsSync(LEGACY_PUBLIC_PATHS)) {
  violations.push("starters/operator/src/api/public-paths.ts must stay deleted")
}

if (app.includes("OPERATOR_PUBLIC_PATHS") || app.includes('from "./public-paths"')) {
  violations.push("Operator must not restore the OPERATOR_PUBLIC_PATHS hand-list")
}

for (const [option, graphField] of [
  ["publicPaths", "publicPaths"],
  ["dbTransactionalPaths", "transactionalPaths"],
]) {
  if (!app.includes(`...graphComposition.routePosture.${graphField}`)) {
    violations.push(`${option} must consume graphComposition.routePosture.${graphField}`)
  }
}

const publicPathLiterals = [...app.matchAll(/["'](\/v1\/public\/[^"']+)["']/g)]
  .map((match) => match[1])
  .sort()
if (publicPathLiterals.length > 0) {
  violations.push(
    `Operator must not contain starter public-path adapters; found ${publicPathLiterals.join(", ")}`,
  )
}

for (const [pattern, label] of [
  [/\banonymous\s*:/, "anonymous"],
  [/\brequiresTransactionalDb\s*:/, "requiresTransactionalDb"],
  [/\btransactionalPaths\s*:/, "transactionalPaths"],
  [/\btransactionalModules\s*:/, "transactionalModules"],
]) {
  if (pattern.test(composition)) {
    violations.push(`Operator graph bindings must not restore package-specific ${label} posture`)
  }
}

for (const legacyNetopiaAuthority of [
  "GENERATED_GRAPH_RUNTIME_PLUGIN_IDS",
  "defineLazyHonoBundle",
  "netopiaHonoBundle",
]) {
  if (app.includes(legacyNetopiaAuthority)) {
    violations.push(
      `Operator must not restore the graph-owned Netopia route adapter (${legacyNetopiaAuthority})`,
    )
  }
}

if (violations.length > 0) {
  console.error("Operator route-posture architecture check failed.")
  console.error("See docs/architecture/unified-deployment-graph.md (Phase 3).\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log(
  "check-operator-route-posture: OK (graph posture mounted; no starter posture hand-lists)",
)
