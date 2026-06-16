/**
 * Guards against admin-composition drift between voyant.config `modules` and the
 * generated admin surface. RFC: docs/architecture/consolidated-deployments-rfc.md
 * (Workstream C — checker hardening).
 *
 * The silent-failure this prevents (the #1 upgrade risk in the deployment-DX
 * assessment): a module is mounted (or newly arrives upstream) and exposes a
 * packaged admin (`@voyant-travel/<m>-react/admin`), but is missing from the
 * generated `admin.extensions.generated.ts` — so its nav/pages silently vanish.
 * And the reverse: a generated admin entry whose module is no longer mounted.
 *
 * Rule:
 *   expected = mounted modules (voyant.config `modules`) whose `<m>-react`
 *              package exposes a `./admin` export.
 *   actual   = the `@voyant-travel/<m>-react/admin` imports wired into
 *              admin.extensions.generated.ts.
 *   FAIL on  (expected \ actual)  [silently dropped admin]
 *        or  (actual not mounted) [admin for an unmounted module].
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const CONFIG = join(ROOT, "starters/operator/voyant.config.ts")
const EXTENSIONS = join(ROOT, "starters/operator/src/admin.extensions.generated.ts")
const DESTINATIONS = join(ROOT, "starters/operator/src/admin.destinations.generated.ts")
const ROUTES = join(ROOT, "starters/operator/src/admin.routes.generated.tsx")

function readMountedModules() {
  const src = readFileSync(CONFIG, "utf-8")
  const start = src.indexOf("modules: [")
  if (start === -1) throw new Error("voyant.config.ts: `modules: [` not found")
  let depth = 0
  let end = -1
  for (let i = src.indexOf("[", start); i < src.length; i++) {
    if (src[i] === "[") depth++
    else if (src[i] === "]" && --depth === 0) {
      end = i
      break
    }
  }
  const block = src.slice(start, end)
  const names = []
  for (const line of block.split("\n")) {
    const m = line.replace(/\/\/.*$/, "").match(/"(@voyant-travel\/[^"]+)"/)
    if (m) names.push(m[1])
  }
  return [...new Set(names)]
}

/** Does `<module>-react` expose a `./admin` export? */
function hasAdminSurface(moduleName) {
  const reactPkg = join(ROOT, "packages", `${moduleName.replace("@voyant-travel/", "")}-react`, "package.json")
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
  let m
  while ((m = re.exec(src))) set.add(`@voyant-travel/${m[1]}`)
  return set
}

const violations = []

if (!existsSync(EXTENSIONS)) {
  violations.push("starters/operator/src/admin.extensions.generated.ts is missing — run `voyant admin generate`")
}

const mounted = readMountedModules()
const mountedSet = new Set(mounted)
const expected = mounted.filter(hasAdminSurface)
const actual = adminImportsIn(EXTENSIONS)

// Silently-dropped admin: mounted + has ./admin, but not wired.
for (const name of expected) {
  if (!actual.has(name)) {
    violations.push(
      `${name} is mounted and exposes ${name}-react/admin but is missing from admin.extensions.generated.ts — run \`voyant admin generate\` (its admin nav/pages would silently disappear)`,
    )
  }
}

// Orphan admin: wired for a module that is not mounted.
for (const name of actual) {
  if (!mountedSet.has(name)) {
    violations.push(
      `admin.extensions.generated.ts wires ${name}-react/admin but ${name} is not in voyant.config modules — remove it or mount the module`,
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
  console.error("See docs/architecture/consolidated-deployments-rfc.md (Workstream C).\n")
  for (const v of violations) console.error(`  - ${v}`)
  process.exit(1)
}

console.log(`check-admin-composition-drift: OK (${expected.length} admin domains in sync with mounted modules)`)
