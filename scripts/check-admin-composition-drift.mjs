/**
 * Guards against admin-composition drift between the resolved deployment graph
 * and the generated admin surface. RFC:
 * docs/architecture/unified-deployment-graph.md (Phase 4).
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
const GRAPH = optionPath(
  "--graph",
  join(ROOT, "starters/operator/.voyant/deployment-graph.generated.json"),
)
const EXTENSIONS = optionPath(
  "--extensions",
  join(ROOT, "starters/operator/src/admin.extensions.generated.ts"),
)
const BUNDLE = optionPath(
  "--bundle",
  join(ROOT, "starters/operator/.voyant/admin/selected-graph-admin.generated.ts"),
)
const COMPATIBILITY = optionPath(
  "--compatibility",
  join(ROOT, "starters/operator/src/lib/admin-extensions.tsx"),
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
      "starters/operator/.voyant/deployment-graph.generated.json is missing — run `pnpm --filter operator graph:emit`",
    )
  }

  const graph = JSON.parse(readFileSync(GRAPH, "utf-8"))
  const units = [...(graph.modules ?? []), ...(graph.extensions ?? []), ...(graph.plugins ?? [])]
  const packages = new Set()
  const bundledPackages = new Set()

  for (const unit of units) {
    if (typeof unit?.packageName === "string" && unit.admin?.runtime) {
      packages.add(unit.packageName)
      bundledPackages.add(unit.packageName)
    }
    if (
      typeof unit?.packageName === "string" &&
      unit.api?.some((route) => route?.surface === "admin")
    ) {
      packages.add(unit.packageName)
    }
  }

  return {
    packages: [...packages].sort(),
    bundledPackages: [...bundledPackages].sort(),
  }
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

function selectedFactoryReferencesIn(file) {
  if (!existsSync(file)) return new Set()
  const src = readFileSync(file, "utf-8")
  const set = new Set()
  const re = /selectedGraphAdminExtensionFactories\s*\[\s*["']([^"']+)["']\s*\]/g
  let match = re.exec(src)
  while (match) {
    set.add(match[1])
    match = re.exec(src)
  }
  return set
}

const violations = []

if (!existsSync(EXTENSIONS)) {
  violations.push(
    "starters/operator/src/admin.extensions.generated.ts is missing — run `voyant admin generate`",
  )
}

const { packages: selected, bundledPackages } = readGraphSelectedAdminPackages()
const selectedSet = new Set(selected)
const expected = selected.filter(hasAdminSurface)
const actual = adminImportsIn(EXTENSIONS)
const bundled = new Set(bundledPackages)
const actualBundle = adminImportsIn(BUNDLE)
const compatibilitySelectedFactories = selectedFactoryReferencesIn(COMPATIBILITY)

// Silently-dropped admin: graph-selected + has ./admin, but not wired.
for (const name of expected) {
  if (!bundled.has(name) && !actual.has(name)) {
    violations.push(
      `${name} is selected by the deployment graph and exposes ${name}-react/admin but is missing from admin.extensions.generated.ts — run \`voyant admin generate\` (its admin nav/pages would silently disappear)`,
    )
  }
}

for (const name of bundled) {
  if (!actualBundle.has(name)) {
    violations.push(
      `${name} declares admin.runtime but is missing from selected-graph-admin.generated.ts — refresh the selected graph artifacts`,
    )
  }
  if (actual.has(name)) {
    violations.push(
      `${name} is duplicated in admin.extensions.generated.ts after migration to the selected-graph admin bundle`,
    )
  }
  if (compatibilitySelectedFactories.has(name)) {
    violations.push(
      `${name} remains package-keyed in the Operator compatibility registry after migration to generic selected-admin composition`,
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

for (const name of actualBundle) {
  if (!bundled.has(name)) {
    violations.push(
      `selected-graph-admin.generated.ts wires ${name} without a selected admin.runtime declaration`,
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
  console.error("See docs/architecture/unified-deployment-graph.md (Phase 4).\n")
  for (const v of violations) console.error(`  - ${v}`)
  process.exit(1)
}

console.log(
  `check-admin-composition-drift: OK (${expected.length} admin domains, ${bundled.size} selected-graph admin bundle)`,
)
