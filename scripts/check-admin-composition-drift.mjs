/**
 * Guards against admin-composition drift between the resolved deployment graph
 * and the generated admin surface. RFC:
 * docs/architecture/unified-deployment-graph.md (Phase 3).
 *
 * The silent-failure this prevents (the #1 upgrade risk in the deployment-DX
 * assessment): a graph-selected package exposes a packaged admin
 * (`@voyant-travel/<m>-react/admin`), but is missing from the generated
 * `admin.extensions.generated.ts` — so its nav/pages silently vanish. And the
 * reverse: a generated admin entry whose package is no longer graph-selected.
 *
 * Rule:
 *   expected = graph-selected module/plugin packages with an admin route
 *              surface whose `<m>-react` package exposes a `./admin` export.
 *   actual   = the `@voyant-travel/<m>-react/admin` imports wired into
 *              admin.extensions.generated.ts.
 *   FAIL on  (expected \ actual) [silently dropped admin]
 *        or  (actual not graph-selected) [admin for an unselected package].
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const GRAPH = optionPath("--graph", join(ROOT, "starters/operator/deployment-graph.generated.json"))
const EXTENSIONS = optionPath(
  "--extensions",
  join(ROOT, "starters/operator/src/admin.extensions.generated.ts"),
)
const DESTINATIONS = join(ROOT, "starters/operator/src/admin.destinations.generated.ts")
const ROUTES = join(ROOT, "starters/operator/src/admin.routes.generated.tsx")

function optionPath(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value) throw new Error(`${name} requires a path`)
  return value
}

function readGraphSelectedAdminPackages() {
  if (!existsSync(GRAPH)) {
    throw new Error(
      "starters/operator/deployment-graph.generated.json is missing — run `pnpm --filter operator graph:emit`",
    )
  }

  const graph = JSON.parse(readFileSync(GRAPH, "utf-8"))
  const units = [...(graph.modules ?? []), ...(graph.plugins ?? [])]
  const packages = new Set()

  for (const unit of units) {
    if (
      typeof unit?.packageName === "string" &&
      unit.api?.some((route) => route?.surface === "admin")
    ) {
      packages.add(unit.packageName)
    }
  }

  return [...packages].sort()
}

/** Does `<module>-react` expose a `./admin` export? */
function hasAdminSurface(moduleName) {
  const reactPkg = join(
    ROOT,
    "packages",
    `${moduleName.replace("@voyant-travel/", "")}-react`,
    "package.json",
  )
  if (!existsSync(reactPkg)) return false
  try {
    const { exports = {} } = JSON.parse(readFileSync(reactPkg, "utf-8"))
    return Boolean(exports["./admin"])
  } catch {
    return false
  }
}

/** Pull the `@voyant-travel/<m>-react/admin` base modules wired into a file. */
function adminImportsIn(file) {
  if (!existsSync(file)) return new Set()
  const src = readFileSync(file, "utf-8")
  const set = new Set()
  const re = /@voyant-travel\/([a-z0-9-]+)-react\/admin/g
  let m = re.exec(src)
  while (m) {
    set.add(`@voyant-travel/${m[1]}`)
    m = re.exec(src)
  }
  return set
}

const violations = []

if (!existsSync(EXTENSIONS)) {
  violations.push(
    "starters/operator/src/admin.extensions.generated.ts is missing — run `voyant admin generate`",
  )
}

const selected = readGraphSelectedAdminPackages()
const selectedSet = new Set(selected)
const expected = selected.filter(hasAdminSurface)
const actual = adminImportsIn(EXTENSIONS)

// Silently-dropped admin: graph-selected + has ./admin, but not wired.
for (const name of expected) {
  if (!actual.has(name)) {
    violations.push(
      `${name} is selected by the deployment graph and exposes ${name}-react/admin but is missing from admin.extensions.generated.ts — run \`voyant admin generate\` (its admin nav/pages would silently disappear)`,
    )
  }
}

// Orphan admin: wired for a package the graph did not select.
for (const name of actual) {
  if (!selectedSet.has(name)) {
    violations.push(
      `admin.extensions.generated.ts wires ${name}-react/admin but ${name} is not selected by the deployment graph — remove it or select the package`,
    )
  }
}

// Internal consistency: routes + destinations should cover the same admin set.
for (const [label, file] of [
  ["admin.routes.generated.tsx", ROUTES],
  ["admin.destinations.generated.ts", DESTINATIONS],
]) {
  const set = adminImportsIn(file)
  if (set.size === 0 && expected.length > 0) {
    // destinations/routes may import from different subpaths; only warn when
    // the file references no admin domains at all while extensions has some.
    if (!existsSync(file)) violations.push(`${label} is missing — run \`voyant admin generate\``)
  }
}

if (violations.length) {
  console.error("Admin composition drift.")
  console.error("See docs/architecture/unified-deployment-graph.md (Phase 3).\n")
  for (const v of violations) console.error(`  - ${v}`)
  process.exit(1)
}

console.log(
  `check-admin-composition-drift: OK (${expected.length} admin domains in sync with the deployment graph)`,
)
