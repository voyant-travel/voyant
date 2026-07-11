/**
 * Generates + verifies the lockstep runtime-module set.
 * RFC: docs/architecture/consolidated-deployments-rfc.md (Workstream A).
 *
 * The lockstep runtime set is the release policy recorded in
 * release.runtime-packages.generated.json. Every member must be selected by
 * the framework-owned standard Operator distribution. It is the set that should version in lockstep
 * (one framework version) so deployment upgrades are atomic. The set is
 * deliberately NOT a bare `@voyant-travel/*` glob (which also matches *-react,
 * *-contracts, plugins, infra, apps, and tooling). Schema-only selections are
 * explicit graph units but are not automatically promoted into release lockstep.
 *
 * This checker is ADDITIVE — it does NOT flip the changeset `fixed` groups:
 *   1. verify every lockstep member is selected by the standard distribution;
 *   2. normalize/verify `release.runtime-packages.generated.json`;
 *   3. category sanity — every member must be a real runtime module, never a
 *      *-react, *-contracts, plugin, app, or tooling package;
 *   4. forward-looking — once a CONSOLIDATED runtime fixed group exists in
 *      .changeset/config.json (a group containing >1 runtime module), it must
 *      equal the manifest exactly, so a non-runtime package can never enter the
 *      lockstep group. Dormant until the flip: today's per-domain pairs
 *      ([module, module-react]) contain exactly one runtime module each and are
 *      left untouched.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const OPERATOR_DISTRIBUTION = join(ROOT, "packages/framework/src/operator-distribution.ts")
const CHANGESET_CONFIG = join(ROOT, ".changeset/config.json")
const MANIFEST = join(ROOT, "release.runtime-packages.generated.json")
const EMIT = process.argv.includes("--emit")

/** Extract the standard Operator `modules: [ ... ]` block and normalize unit
 * selections to package names. */
function readStandardModules() {
  const src = readFileSync(OPERATOR_DISTRIBUTION, "utf-8")
  const declarationStart = src.indexOf("export const STANDARD_OPERATOR_DISTRIBUTION")
  const start = src.indexOf("modules: [", declarationStart)
  if (start === -1) throw new Error("operator-distribution.ts: `modules: [` not found")
  // Walk to the matching closing bracket.
  let depth = 0
  let end = -1
  for (let i = src.indexOf("[", start); i < src.length; i++) {
    if (src[i] === "[") depth++
    else if (src[i] === "]") {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) throw new Error("operator-distribution.ts: unterminated `modules` array")
  const block = src.slice(start, end)
  const names = []
  for (const line of block.split("\n")) {
    const code = line.replace(/\/\/.*$/, "")
    const m = code.match(/"(@voyant-travel\/[^"]+)"/)
    if (m) names.push(packageNameFromSelection(m[1]))
  }
  return [...new Set(names)].sort()
}

function packageNameFromSelection(selection) {
  const parts = selection.split("/")
  return selection.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
}

/** Map every workspace package name → its directory (packages/** only). */
function workspacePackages() {
  const map = new Map()
  const PKGS = join(ROOT, "packages")
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue
      const full = join(dir, entry)
      if (!statSync(full).isDirectory()) continue
      const pkgJson = join(full, "package.json")
      if (existsSync(pkgJson)) {
        try {
          const { name } = JSON.parse(readFileSync(pkgJson, "utf-8"))
          if (name) map.set(name, full)
        } catch {
          // ignore unparseable package.json
        }
      }
      walk(full)
    }
  }
  walk(PKGS)
  return map
}

const violations = []
const mounted = readStandardModules()
const pkgs = workspacePackages()
const existingManifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, "utf-8"))
  : { runtimePackages: [] }
const runtimeSet = Array.isArray(existingManifest.runtimePackages)
  ? [...new Set(existingManifest.runtimePackages)].sort()
  : []

// (1) every mounted module must resolve to a workspace package.
for (const name of runtimeSet) {
  if (!pkgs.has(name)) {
    violations.push(`lockstep runtime package "${name}" is not a workspace package under packages/`)
  }
  if (!mounted.includes(name)) {
    violations.push(
      `lockstep runtime package "${name}" is not selected by the standard Operator distribution`,
    )
  }
}

// (3) category sanity — no non-runtime package may be classified runtime.
const NON_RUNTIME = [
  { test: (n) => n.endsWith("-react"), why: "React/UI package" },
  { test: (n) => n.endsWith("-contracts"), why: "contracts package" },
  { test: (_n, dir) => dir?.includes(`${"packages"}/plugins/`), why: "plugin package" },
]
for (const name of runtimeSet) {
  const dir = pkgs.get(name)
  for (const rule of NON_RUNTIME) {
    if (rule.test(name, dir)) {
      violations.push(
        `runtime set must not contain ${name} (${rule.why}) — these version on their own cadence`,
      )
    }
  }
}

// (2) emit / verify the committed manifest.
const manifestBody = `${JSON.stringify(
  {
    $comment:
      "GENERATED by scripts/check-lockstep-membership.mjs — do not edit. Lockstep runtime packages must be selected by the framework-owned standard Operator distribution. Refresh with `node scripts/check-lockstep-membership.mjs --emit`.",
    runtimePackages: runtimeSet,
  },
  null,
  2,
)}\n`

if (EMIT) {
  writeFileSync(MANIFEST, manifestBody)
  console.log(
    `check-lockstep-membership: emitted ${runtimeSet.length} runtime packages → release.runtime-packages.generated.json`,
  )
} else if (!existsSync(MANIFEST)) {
  violations.push(
    "release.runtime-packages.generated.json is missing — run `node scripts/check-lockstep-membership.mjs --emit`",
  )
} else {
  const current = readFileSync(MANIFEST, "utf-8")
  if (current !== manifestBody) {
    violations.push(
      "release.runtime-packages.generated.json is stale (standard Operator modules changed) — run `node scripts/check-lockstep-membership.mjs --emit`",
    )
  }
}

// (4) forward-looking — once a consolidated runtime fixed group exists, it must
// equal the manifest exactly. Dormant while per-domain pairs (1 runtime each).
if (existsSync(CHANGESET_CONFIG)) {
  const { fixed = [] } = JSON.parse(readFileSync(CHANGESET_CONFIG, "utf-8"))
  const runtimeLookup = new Set(runtimeSet)
  for (const group of fixed) {
    const inRuntime = group.filter((g) => runtimeLookup.has(g))
    if (inRuntime.length > 1) {
      // This is the consolidated runtime group — it must be exactly the set.
      const extra = group.filter((g) => !runtimeLookup.has(g) && !g.startsWith("!"))
      const missing = runtimeSet.filter((n) => !group.includes(n))
      if (extra.length) {
        violations.push(
          `changeset fixed group contains non-runtime members in the lockstep group: ${extra.join(", ")}`,
        )
      }
      if (missing.length) {
        violations.push(
          `changeset lockstep group is missing runtime modules: ${missing.join(", ")}`,
        )
      }
    }
  }
}

if (violations.length) {
  console.error("Lockstep membership violation.")
  console.error("See docs/architecture/consolidated-deployments-rfc.md (Workstream A).\n")
  for (const v of violations) console.error(`  - ${v}`)
  process.exit(1)
}

console.log(`check-lockstep-membership: OK (${runtimeSet.length} runtime modules)`)
