#!/usr/bin/env node
// Generates tsconfig.build.json + tsconfig.typecheck.json for the "heavy"
// workspace packages whose own build/typecheck OOM'd once the @hono/zod-openapi
// route surfaces grew (voyant#2114): their `tsc` re-infers DEPENDENCY source.
// These configs add a `paths` map pointing each @voyant-travel/* dep at its
// prebuilt dist/*.d.ts (so tsc reads declarations, not source), EXCLUDING the
// package's own specifiers (self-imports must stay on source, else tsc reports
// TS5055 "would overwrite input file"). A per-package turbo.json makes typecheck
// depend on ^build so the declarations exist. dev/editor/vite/vitest are
// untouched — they use each package's tsconfig.json + `exports` (source).
//
// Re-run after changing any package's `exports`:
//   node scripts/gen-heavy-package-dep-paths.mjs

import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
// Packages whose typecheck/build re-infer enough dependency source to exceed the
// 8 GB CI budget. Add a package here if its build/typecheck OOMs.
const HEAVY = ["commerce", "distribution", "identity", "octo"]

function sourceTarget(value) {
  if (typeof value === "string") return value
  if (value && typeof value === "object") {
    for (const cond of ["types", "development", "import", "default", "node"]) {
      const v = value[cond]
      if (typeof v === "string" && v.startsWith("./src/")) return v
    }
  }
  return undefined
}

// Collect every buildable workspace package's dist declaration entries.
const entries = []
for (const base of ["packages", "packages/plugins"]) {
  const baseAbs = join(ROOT, base)
  if (!existsSync(baseAbs)) continue
  for (const entry of readdirSync(baseAbs, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pkgPath = join(baseAbs, entry.name, "package.json")
    if (!existsSync(pkgPath)) continue
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    if (!pkg.name || !pkg.scripts?.build) continue
    for (const [key, value] of Object.entries(pkg.exports ?? {})) {
      const target = sourceTarget(value)
      if (!target) continue
      if (!target.startsWith("./src/") || !/\.tsx?$/.test(target)) continue
      if ((key.match(/\*/g) ?? []).length > 1 || (target.match(/\*/g) ?? []).length > 1) continue
      const specifier = key === "." ? pkg.name : `${pkg.name}${key.slice(1)}`
      const distAbs = join(
        baseAbs,
        entry.name,
        target.replace(/^\.\/src\//, "dist/").replace(/\.tsx?$/, ".d.ts"),
      )
      entries.push({ specifier, distAbs, owner: pkg.name })
    }
  }
}

const written = []
for (const name of HEAVY) {
  const dir = join(ROOT, "packages", name)
  const ownName = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name
  const paths = {}
  for (const e of entries) {
    if (e.owner === ownName) continue // self-imports stay on source (avoid TS5055)
    const rel = relative(dir, e.distAbs).split(sep).join("/")
    paths[e.specifier] = [rel.startsWith(".") ? rel : `./${rel}`]
  }
  const sorted = Object.fromEntries(
    Object.keys(paths)
      .sort()
      .map((k) => [k, paths[k]]),
  )
  writeFileSync(
    join(dir, "tsconfig.build.json"),
    `${JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { paths: sorted } }, null, 2)}\n`,
  )
  writeFileSync(
    join(dir, "tsconfig.typecheck.json"),
    `${JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { noEmit: true, paths: sorted } }, null, 2)}\n`,
  )
  writeFileSync(
    join(dir, "turbo.json"),
    `${JSON.stringify({ extends: ["//"], tasks: { typecheck: { dependsOn: ["^build"] } } }, null, 2)}\n`,
  )
  written.push(`${name} (${Object.keys(sorted).length} dep-paths)`)
}

// Byte-stable output so the freshness check can assert no diff.
const files = HEAVY.flatMap((n) => [
  `packages/${n}/tsconfig.build.json`,
  `packages/${n}/tsconfig.typecheck.json`,
])
execFileSync("pnpm", ["biome", "format", "--write", ...files], { cwd: ROOT, stdio: "ignore" })
console.log(`heavy-package dep-paths:\n  ${written.join("\n  ")}`)
