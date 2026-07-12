/**
 * Guards against admin-composition drift between the resolved deployment graph
 * and the generated admin surface. RFC:
 * docs/architecture/unified-deployment-graph.md (Phase 4).
 *
 * The silent-failure this prevents (the #1 upgrade risk in the deployment-DX
 * assessment): a graph-selected package exposes a packaged admin but does not
 * declare admin.runtime, so its nav/pages silently vanish or fall back to a
 * starter-owned compatibility catalog.
 *
 * Rule:
 *   expected = graph-selected module/plugin packages with an admin route
 *              surface whose `<m>-react` package exposes a `./admin` export.
 *   actual   = the package imports in the selected-graph admin bundle.
 *   FAIL when any expected package is absent, or when a compatibility
 *        registry exists at all.
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
const ROUTER = optionPath("--router", join(ROOT, "starters/operator/src/router.tsx"))
const DESTINATIONS = optionPath(
  "--destinations-source",
  join(ROOT, "starters/operator/src/lib/admin-destinations.ts"),
)
const OPERATOR_PACKAGE = optionPath(
  "--operator-package",
  join(ROOT, "starters/operator/package.json"),
)
const ADMIN_HOST_DESTINATIONS = optionPath(
  "--admin-host-destinations",
  join(ROOT, "packages/admin-host/src/admin-destinations.ts"),
)
const LEGACY_ROUTES = optionPath(
  "--legacy-routes",
  join(ROOT, "starters/operator/src/admin.routes.generated.tsx"),
)
const LEGACY_DESTINATIONS = optionPath(
  "--legacy-destinations",
  join(ROOT, "starters/operator/src/admin.destinations.generated.ts"),
)
const LEGACY_GENERATOR = optionPath(
  "--legacy-generator",
  join(ROOT, "starters/operator/scripts/run-admin-generator.ts"),
)

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

if (existsSync(EXTENSIONS)) {
  violations.push(
    "starters/operator/src/admin.extensions.generated.ts must not exist; all admin factories must be selected-graph owned",
  )
}

for (const [label, file] of [
  ["admin.routes.generated.tsx", LEGACY_ROUTES],
  ["admin.destinations.generated.ts", LEGACY_DESTINATIONS],
  ["run-admin-generator.ts", LEGACY_GENERATOR],
]) {
  if (existsSync(file)) {
    violations.push(
      `${label} must not exist; .voyant selected-graph admin composition is authoritative`,
    )
  }
}

const routerSource = existsSync(ROUTER) ? readFileSync(ROUTER, "utf8") : ""
if (
  !routerSource.includes("buildAdminExtensionRoutes") ||
  !routerSource.includes("adminExtensions")
) {
  violations.push(
    "Operator router must build routes from the selected-graph admin extension registry",
  )
}

const destinationsSource = existsSync(DESTINATIONS) ? readFileSync(DESTINATIONS, "utf8") : ""
if (
  !destinationsSource.includes("createAdminHostDestinations(adminExtensions)") ||
  destinationsSource.includes("admin.destinations.generated")
) {
  violations.push(
    "Operator destinations must derive from the selected-graph admin extension registry",
  )
}

const hostDestinationsSource = existsSync(ADMIN_HOST_DESTINATIONS)
  ? readFileSync(ADMIN_HOST_DESTINATIONS, "utf8")
  : ""
if (!hostDestinationsSource.includes("buildAdminExtensionDestinations(extensions)")) {
  violations.push("Admin host must derive destination resolvers from extension route metadata")
}

const operatorPackageSource = existsSync(OPERATOR_PACKAGE)
  ? readFileSync(OPERATOR_PACKAGE, "utf8")
  : ""
for (const legacyToken of [
  "admin:generate",
  "admin:check",
  "run-admin-generator",
  "--routes",
  "--destinations",
]) {
  if (operatorPackageSource.includes(legacyToken)) {
    violations.push(`Operator package retains legacy admin generation token ${legacyToken}`)
  }
}

const { packages: selected, bundledPackages } = readGraphSelectedAdminPackages()
const expected = selected.filter(hasAdminSurface)
const bundled = new Set(bundledPackages)
const actualBundle = adminImportsIn(BUNDLE)
const compatibilityImports = adminImportsIn(COMPATIBILITY)
const compatibilitySelectedFactories = selectedFactoryReferencesIn(COMPATIBILITY)

// Silently-dropped admin: graph-selected + has ./admin, but not bundled.
for (const name of expected) {
  if (!bundled.has(name)) {
    violations.push(
      `${name} is selected by the deployment graph and exposes ${name}-react/admin but does not declare admin.runtime`,
    )
  }
}

for (const name of bundled) {
  if (!actualBundle.has(name)) {
    violations.push(
      `${name} declares admin.runtime but is missing from selected-graph-admin.generated.ts — refresh the selected graph artifacts`,
    )
  }
  if (compatibilitySelectedFactories.has(name)) {
    violations.push(
      `${name} remains package-keyed in the Operator compatibility registry after migration to generic selected-admin composition`,
    )
  }
}

for (const name of compatibilityImports) {
  violations.push(
    `${name} remains imported by the Operator admin compatibility composition after selected-graph migration`,
  )
}

for (const name of actualBundle) {
  if (!bundled.has(name)) {
    violations.push(
      `selected-graph-admin.generated.ts wires ${name} without a selected admin.runtime declaration`,
    )
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
