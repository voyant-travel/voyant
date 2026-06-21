/**
 * D.2 module-boundary linter. A hard cross-package FK
 * (`.references(() => otherPackageTable.id)`) violates the module-decoupling
 * rule — cross-module associations must be plain `text`/`typeId` columns +
 * `defineLink` at the template level, validated in the service layer. The
 * monolithic framework bundle HIDES these (every table is in one database);
 * per-package migrations (D.2) cannot apply in isolation when they exist, so
 * this linter is the static counterpart to the per-package baseline verifier.
 *
 * Scans every package's schema source for `.references(() => sym...)` where
 * `sym` is imported from a DIFFERENT `@voyant-travel/*` package, then splits by
 * whether the owner is declared in `voyant.requiresSchemas`:
 *   • UNDECLARED → hard error. The dependency isn't in the DAG, so topo-order
 *     can't guarantee the referenced table exists first — and an undeclared
 *     horizontal FK is a module-decoupling violation. (Exit 1.)
 *   • DECLARED → reported as an intentional vertical-extension FK. Acceptable
 *     for D.2 because topo-order applies the owner package first; flagged only
 *     so the coupling stays visible.
 *
 * Run: node scripts/migrations/lint-package-boundaries.mjs   (exit 1 on UNDECLARED)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = new URL("../..", import.meta.url).pathname
const PKGS = join(ROOT, "packages")

/** All *.ts under a dir (excluding tests, node_modules, dist). */
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist") continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith(".ts") && !e.name.includes(".test.")) out.push(p)
  }
  return out
}

const violations = []

for (const pkg of readdirSync(PKGS, { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue
  const pkgDir = join(PKGS, pkg.name)
  const pjPath = join(pkgDir, "package.json")
  if (!existsSync(pjPath)) continue
  const pj = JSON.parse(readFileSync(pjPath, "utf8"))
  const selfName = pj.name
  const required = new Set(pj.voyant?.requiresSchemas ?? [])
  const srcDir = join(pkgDir, "src")
  if (!existsSync(srcDir)) continue

  for (const file of walk(srcDir)) {
    const text = readFileSync(file, "utf8")
    if (!text.includes(".references(")) continue

    // Map each imported symbol -> the @voyant-travel/* package it came from
    // (only cross-package imports we care about; skip db type helpers / self).
    const symToPkg = new Map()
    const importRe =
      /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["'](@voyant-travel\/[^"'/]+)[^"']*["']/g
    for (const m of text.matchAll(importRe)) {
      const from = m[2]
      if (from === selfName || from === "@voyant-travel/db") continue
      for (const raw of m[1].split(",")) {
        const sym = raw
          .trim()
          .split(/\s+as\s+/)[0]
          .trim()
        if (sym) symToPkg.set(sym, from)
      }
    }
    if (symToPkg.size === 0) continue

    // Flag `.references(() => <sym>...)` where sym is cross-package.
    const refRe = /\.references\(\s*\(\)\s*=>\s*([A-Za-z_$][\w$]*)/g
    for (const m of text.matchAll(refRe)) {
      const owner = symToPkg.get(m[1])
      if (owner) {
        const line = text.slice(0, m.index).split("\n").length
        violations.push({
          pkg: selfName,
          owner,
          sym: m[1],
          file: file.replace(`${ROOT}`, ""),
          line,
          declared: required.has(owner),
        })
      }
    }
  }
}

const undeclared = violations.filter((v) => !v.declared)
const declared = violations.filter((v) => v.declared)

const group = (vs) => {
  const m = new Map()
  for (const v of vs) {
    if (!m.has(v.pkg)) m.set(v.pkg, [])
    m.get(v.pkg).push(v)
  }
  return m
}

if (declared.length > 0) {
  console.log(
    `Declared vertical-extension FKs (acceptable for D.2 — topo-order applies the owner first):\n`,
  )
  for (const [pkg, vs] of group(declared)) {
    console.log(`  ${pkg}`)
    for (const v of vs) console.log(`    → ${v.owner}::${v.sym}   (${v.file}:${v.line})`)
  }
  console.log("")
}

if (undeclared.length === 0) {
  console.log("lint-package-boundaries: OK — no UNDECLARED cross-package FK references")
  process.exit(0)
}

console.log(
  `lint-package-boundaries: ${undeclared.length} UNDECLARED cross-package FK reference(s) — these break per-package migrations (owner not in requiresSchemas) and violate module decoupling:\n`,
)
for (const [pkg, vs] of group(undeclared)) {
  console.log(`  ${pkg}  (requiresSchemas does not list the owner)`)
  for (const v of vs) console.log(`    ✗ ${v.owner}::${v.sym}   (${v.file}:${v.line})`)
}
console.log(
  "\nFix: drop `.references()`, keep the plain typeId/text column + index, and add a `defineLink` at the deployment + service-layer validation.",
)
process.exit(1)
