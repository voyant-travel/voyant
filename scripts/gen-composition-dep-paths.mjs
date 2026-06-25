#!/usr/bin/env node
// Generates a tsconfig `paths` map that points every workspace package
// specifier at its built `dist/*.d.ts` declaration, and injects it into the
// composition-point typecheck configs (the operator server program, the
// framework composition, and the openapi spec package).
//
// Why: those three tsc programs compose ~every module's routes, and because
// each package's `exports` points at SOURCE (`./src/index.ts`), tsc transitively
// re-typechecks all module source — a working set that grows with every
// @hono/zod-openapi admin batch and OOMs the CI runner (voyant#2114). `paths`
// takes precedence over `exports` in tsc, so overriding ONLY these typecheck
// configs makes them read prebuilt declarations (already type-checked, no
// re-inference) while dev/test/vite/editor resolution stays on source, untouched.
//
// Re-run after changing any package's `exports` (a CI check enforces freshness).
//   node scripts/gen-composition-dep-paths.mjs

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/** Strip `//` line and block comments from JSONC, ignoring comment-like text
 * inside string literals (so URLs / `./src/*` paths survive). */
function stripJsonComments(text) {
  let out = ""
  let inString = false
  let inLine = false
  let inBlock = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]
    if (inLine) {
      if (c === "\n") {
        inLine = false
        out += c
      }
      continue
    }
    if (inBlock) {
      if (c === "*" && next === "/") {
        inBlock = false
        i++
      }
      continue
    }
    if (inString) {
      out += c
      if (c === "\\") {
        out += text[i + 1] ?? ""
        i++
      } else if (c === '"') {
        inString = false
      }
      continue
    }
    if (c === '"') {
      inString = true
      out += c
      continue
    }
    if (c === "/" && next === "/") {
      inLine = true
      i++
      continue
    }
    if (c === "/" && next === "*") {
      inBlock = true
      i++
      continue
    }
    out += c
  }
  return out
}

const PKG_GLOBS = ["packages", "packages/plugins"]

/** Collect every workspace package dir that has a package.json with a name. */
function collectPackages() {
  const out = []
  for (const base of PKG_GLOBS) {
    const baseAbs = join(ROOT, base)
    if (!existsSync(baseAbs)) continue
    for (const entry of readdirSync(baseAbs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pkgPath = join(baseAbs, entry.name, "package.json")
      if (!existsSync(pkgPath)) continue
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
      if (!pkg.name) continue
      // Only packages that emit a `dist` (have a build script) can be resolved
      // to declarations; source-only packages (e.g. test-utils) keep resolving
      // via their `exports` (src) — negligible cost, avoids a dangling path.
      if (!pkg.scripts?.build) continue
      out.push({ name: pkg.name, dir: join(base, entry.name), exports: pkg.exports ?? {} })
    }
  }
  return out
}

/** Map a package's `exports` to `{ specifier: distDeclAbsPath }` entries. */
function declEntries(pkg) {
  const entries = []
  for (const [key, value] of Object.entries(pkg.exports)) {
    if (typeof value !== "string") continue // skip condition objects / non-string
    if (!value.startsWith("./src/")) continue // only source entrypoints
    if (!/\.tsx?$/.test(value)) continue // only TS sources have .d.ts
    // tsc `paths` patterns allow at most ONE `*`; skip multi-wildcard subpath
    // exports (e.g. `./schema/*/*`) and let them resolve via `exports` (src).
    if ((key.match(/\*/g) ?? []).length > 1 || (value.match(/\*/g) ?? []).length > 1) continue
    const specifier = key === "." ? pkg.name : `${pkg.name}${key.slice(1)}`
    const distRel = value.replace(/^\.\/src\//, "dist/").replace(/\.tsx?$/, ".d.ts")
    entries.push([specifier, join(ROOT, pkg.dir, distRel)])
  }
  return entries
}

function buildPaths(packages, configDir) {
  const paths = {}
  for (const pkg of packages) {
    for (const [specifier, declAbs] of declEntries(pkg)) {
      // POSIX-style relative path from the consuming tsconfig dir.
      const rel = relative(configDir, declAbs).split("\\").join("/")
      paths[specifier] = [rel.startsWith(".") ? rel : `./${rel}`]
    }
  }
  // Stable ordering for clean diffs.
  return Object.fromEntries(
    Object.keys(paths)
      .sort()
      .map((k) => [k, paths[k]]),
  )
}

/**
 * Inject the generated paths into a config's compilerOptions.paths, preserving
 * any non-workspace aliases (e.g. operator's `@/*`). Workspace aliases (those
 * starting with `@voyant-travel/`) are fully replaced by the generated set.
 */
function injectPaths(configRelPath, extraAliases) {
  const configAbs = join(ROOT, configRelPath)
  const configDir = dirname(configAbs)
  const generated = buildPaths(packages, configDir)
  const merged = { ...extraAliases, ...generated }

  const raw = readFileSync(configAbs, "utf8")
  const json = JSON.parse(stripJsonComments(raw))
  json.compilerOptions ??= {}
  json.compilerOptions.paths = merged
  writeFileSync(configAbs, `${JSON.stringify(json, null, 2)}\n`)
  console.log(`updated ${configRelPath}: ${Object.keys(generated).length} workspace decl paths`)
}

const packages = collectPackages()

// operator server program keeps its own `@/*` alias.
injectPaths("starters/operator/tsconfig.server.json", { "@/*": ["./src/*"] })
