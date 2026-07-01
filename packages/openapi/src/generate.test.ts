import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { selectSurface } from "@voyant-travel/hono/openapi"
import { describe, expect, it } from "vitest"
import { buildFrameworkOpenApiDocuments } from "./generate.js"

/**
 * Drift gate for the published framework spec (voyant#2733).
 *
 * The API contract is generated per module from each module's own routes — the
 * authoritative boundary — not split out of one giant document. The compact
 * per-module files under `spec/{admin,storefront}/<module>.json` are the
 * committed, browsable, drift-gated surface; regenerating from the framework
 * composition must reproduce them exactly (added/changed/removed routes fail
 * CI). The multi-megabyte aggregates (`spec/framework-*.json`) are NOT committed
 * — they're generated on demand (here + at `prepack` for the npm tarball), so
 * git never carries a 7 MB file no tool can render. Refresh with:
 *   pnpm --filter @voyant-travel/openapi generate
 */
const SPEC_DIR = join(process.cwd(), "spec")
const docs = await buildFrameworkOpenApiDocuments()
const serialize = (doc: unknown) => `${JSON.stringify(doc, null, 2)}\n`

/** The aggregate artifacts — generated, gitignored, shipped in the tarball. */
const aggregates = {
  "framework-openapi.json": docs.full,
  "framework-admin.json": docs.admin,
  "framework-storefront.json": docs.storefront,
}

/** The committed per-module surface files, keyed by their path under `spec/`. */
const perModule: Record<string, unknown> = {}
for (const [moduleName, doc] of docs.modules) {
  const admin = selectSurface(doc, "admin")
  if (Object.keys(admin.paths ?? {}).length > 0) perModule[`admin/${moduleName}.json`] = admin
  const storefront = selectSurface(doc, "storefront")
  if (Object.keys(storefront.paths ?? {}).length > 0)
    perModule[`storefront/${moduleName}.json`] = storefront
}

if (process.env.UPDATE_OPENAPI) {
  mkdirSync(SPEC_DIR, { recursive: true })
  for (const [name, doc] of Object.entries(aggregates)) {
    writeFileSync(join(SPEC_DIR, name), serialize(doc))
  }
  // Rewrite the committed per-module dirs from scratch so a removed module drops
  // its stale file instead of lingering.
  for (const surface of ["admin", "storefront"]) {
    rmSync(join(SPEC_DIR, surface), { recursive: true, force: true })
    mkdirSync(join(SPEC_DIR, surface), { recursive: true })
  }
  for (const [name, doc] of Object.entries(perModule)) {
    writeFileSync(join(SPEC_DIR, name), serialize(doc))
  }
}

/** List committed `spec/{admin,storefront}/*.json` relative paths. */
function committedPerModuleFiles(): string[] {
  const out: string[] = []
  for (const surface of ["admin", "storefront"]) {
    let entries: string[]
    try {
      entries = readdirSync(join(SPEC_DIR, surface))
    } catch {
      continue
    }
    for (const entry of entries) if (entry.endsWith(".json")) out.push(`${surface}/${entry}`)
  }
  return out.sort()
}

describe("framework openapi spec", () => {
  it("generates a 3.1.0 document", () => {
    expect(docs.full.openapi).toBe("3.1.0")
  })

  it("excludes deployment-local routes (framework surface only)", () => {
    const allPaths = Object.keys(docs.full.paths ?? {})
    // Operator-local modules (MICE, cruises) and provider plugins (Netopia) must
    // never appear in the framework contract.
    expect(allPaths.some((p) => p.includes("/mice") || p.includes("/cruises"))).toBe(false)
    for (const p of Object.keys(docs.admin.paths ?? {}))
      expect(p.startsWith("/v1/admin")).toBe(true)
    for (const p of Object.keys(docs.storefront.paths ?? {}))
      expect(p.startsWith("/v1/public")).toBe(true)
  })

  it("emits at least one per-module document", () => {
    expect(Object.keys(perModule).length).toBeGreaterThan(0)
  })

  it("keeps every per-module path within the aggregate (no invented routes)", () => {
    const fullPaths = new Set(Object.keys(docs.full.paths ?? {}))
    for (const [name, doc] of Object.entries(perModule)) {
      for (const p of Object.keys((doc as { paths?: object }).paths ?? {})) {
        expect(
          fullPaths.has(p),
          `${name} contributes a path missing from the aggregate: ${p}`,
        ).toBe(true)
      }
    }
  })

  it("covers every admin/storefront path (nothing dropped, incl. non-module routes)", () => {
    const covered = new Set<string>()
    for (const doc of Object.values(perModule)) {
      for (const p of Object.keys((doc as { paths?: object }).paths ?? {})) covered.add(p)
    }
    const surfacePaths = Object.keys(docs.full.paths ?? {}).filter(
      (p) => p.startsWith("/v1/admin/") || p.startsWith("/v1/public/"),
    )
    const missing = surfacePaths.filter((p) => !covered.has(p))
    expect(
      missing,
      `surface paths missing from every per-module doc: ${missing.join(", ")}`,
    ).toEqual([])
  })

  it("has no stale or missing committed per-module files", () => {
    expect(committedPerModuleFiles()).toEqual(Object.keys(perModule).sort())
  })

  for (const [name, doc] of Object.entries(perModule)) {
    it(`${name} matches the committed artifact (no drift)`, () => {
      let committed: string
      try {
        committed = readFileSync(join(SPEC_DIR, name), "utf8")
      } catch {
        throw new Error(
          `${name} is missing — run \`pnpm --filter @voyant-travel/openapi generate\` and commit it.`,
        )
      }
      expect(
        serialize(doc),
        `${name} is out of date — run \`pnpm --filter @voyant-travel/openapi generate\` and commit the result.`,
      ).toBe(committed)
    })
  }
})
