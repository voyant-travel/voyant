import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const WORKSPACE_ROOT = join(fileURLToPath(import.meta.url), "../../../../..")
const PACKAGES_DIR = join(WORKSPACE_ROOT, "packages")

// Files allowed to runtime-import from the `@voyant-travel/db` root entry. These
// are server-only modules whose code never reaches client bundles. Every
// other consumer must import from a leaf subpath (e.g. `@voyant-travel/db/lib/typeid`)
// to avoid dragging `drizzle-orm/postgres-js` + `postgres` (and Node `Buffer`)
// into transitive client bundles — see issue #968.
const ALLOW_LIST = new Set(["auth/src/server.ts", "auth/src/edge.ts"])

function* walkTsFiles(dir: string): Generator<string> {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue
    const abs = join(dir, entry)
    const st = statSync(abs)
    if (st.isDirectory()) {
      yield* walkTsFiles(abs)
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      yield abs
    }
  }
}

function findDbRootRuntimeImports(_file: string, source: string): number[] {
  const lines = source.split("\n")
  const offenders: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (!line.includes("@voyant-travel/db")) continue
    if (!/from\s+["']@voyant-travel\/db["']/.test(line)) continue
    // Walk backwards to find the line that opens this import/export statement
    // (handles multi-line imports).
    let start = i
    while (start > 0 && !/^\s*(import|export)\b/.test(lines[start]!)) start--
    const opener = lines[start]!
    // Skip pure type-only declarations.
    if (/^\s*(import|export)\s+type\b/.test(opener)) continue
    offenders.push(i + 1)
  }
  return offenders
}

describe("no @voyant-travel/db root runtime imports outside the allow list", () => {
  it("findDbRootRuntimeImports flags runtime imports but skips type-only ones", () => {
    // Self-check: catch regressions where the detector goes blind.
    const sample = [
      `import { newId } from "@voyant-travel/db"`, // runtime — line 1
      `import type { AnyDrizzleDb } from "@voyant-travel/db"`, // type — skip
      `import {`, // multi-line runtime — opens at line 3
      `  newId,`,
      `} from "@voyant-travel/db"`, // line 5 (offender)
      `import type {`, // multi-line type — opens at line 6
      `  AnyDrizzleDb,`,
      `} from "@voyant-travel/db"`, // line 8 (skip)
      `export * from "@voyant-travel/db"`, // runtime re-export — line 9
    ].join("\n")
    expect(findDbRootRuntimeImports("inline", sample)).toEqual([1, 5, 9])
  })

  it("server packages must use leaf subpaths so client bundles don't drag drizzle/postgres (issue #968)", () => {
    const offenders: string[] = []
    let packages: string[]
    try {
      packages = readdirSync(PACKAGES_DIR)
    } catch (error) {
      throw new Error(`Cannot read workspace packages dir at ${PACKAGES_DIR}: ${String(error)}`)
    }

    // Skip `db` itself — its src files import via `./` relatives, not via the
    // `@voyant-travel/db` package name.
    for (const pkg of packages) {
      if (pkg === "db") continue
      const srcDir = join(PACKAGES_DIR, pkg, "src")
      for (const file of walkTsFiles(srcDir)) {
        const rel = file.slice(PACKAGES_DIR.length + 1)
        if (ALLOW_LIST.has(rel)) continue
        const source = readFileSync(file, "utf8")
        for (const lineNumber of findDbRootRuntimeImports(file, source)) {
          offenders.push(`${rel}:${lineNumber}`)
        }
      }
    }

    expect(
      offenders,
      `Found runtime imports from "@voyant-travel/db" (root). Use a leaf subpath like ` +
        `"@voyant-travel/db/lib/typeid" or "@voyant-travel/db/lib/typeid-column" so client ` +
        `bundles don't pull drizzle-orm/postgres-js + postgres. Offenders:\n` +
        offenders.join("\n"),
    ).toEqual([])
  }, 30_000)
})
