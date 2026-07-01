import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { selectSurface } from "@voyant-travel/hono/openapi"
import { describe, expect, it } from "vitest"
import { buildOperatorOpenApiDocuments } from "./openapi.js"

/**
 * OpenAPI drift gate for the operator deployment (voyant#2733, was #2114).
 *
 * Specs are generated per module from each module's own routes — the
 * authoritative boundary — not split out of one giant document. The compact
 * per-module files under `openapi/{admin,storefront}/<module>.json` are the
 * committed, browsable, drift-gated surface; regenerating from the composed app
 * must reproduce them exactly (added/changed/removed routes fail CI). The
 * multi-megabyte aggregates (`openapi/framework-*.json`) are NOT committed —
 * they're generated on demand, so git never carries a 7 MB file no tool can
 * render, and the deployment composes the aggregate only if it wants it.
 *
 * To update after an intentional route change:
 *   pnpm --filter operator generate:openapi
 * (runs this file with `UPDATE_OPENAPI=1`, rewriting the artifacts).
 */
const OUT_DIR = join(process.cwd(), "openapi")
const docs = await buildOperatorOpenApiDocuments()
const serialize = (doc: unknown) => `${JSON.stringify(doc, null, 2)}\n`

/** The aggregate artifacts — generated on demand, gitignored. */
const aggregates = {
  "framework-openapi.json": docs.full,
  "framework-admin.json": docs.admin,
  "framework-storefront.json": docs.storefront,
}

/** The committed per-module surface files, keyed by their path under `openapi/`. */
const perModule: Record<string, unknown> = {}
for (const [moduleName, doc] of docs.modules) {
  const admin = selectSurface(doc, "admin")
  if (Object.keys(admin.paths ?? {}).length > 0) perModule[`admin/${moduleName}.json`] = admin
  const storefront = selectSurface(doc, "storefront")
  if (Object.keys(storefront.paths ?? {}).length > 0)
    perModule[`storefront/${moduleName}.json`] = storefront
}

if (process.env.UPDATE_OPENAPI) {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const [name, doc] of Object.entries(aggregates)) {
    writeFileSync(join(OUT_DIR, name), serialize(doc))
  }
  // Rewrite the committed per-module dirs from scratch so a removed module drops
  // its stale file instead of lingering.
  for (const surface of ["admin", "storefront"]) {
    rmSync(join(OUT_DIR, surface), { recursive: true, force: true })
    mkdirSync(join(OUT_DIR, surface), { recursive: true })
  }
  for (const [name, doc] of Object.entries(perModule)) {
    writeFileSync(join(OUT_DIR, name), serialize(doc))
  }
}

/** List committed `openapi/{admin,storefront}/*.json` relative paths. */
function committedPerModuleFiles(): string[] {
  const out: string[] = []
  for (const surface of ["admin", "storefront"]) {
    let entries: string[]
    try {
      entries = readdirSync(join(OUT_DIR, surface))
    } catch {
      continue
    }
    for (const entry of entries) if (entry.endsWith(".json")) out.push(`${surface}/${entry}`)
  }
  return out.sort()
}

describe("operator openapi spec", () => {
  it("is generated as a 3.1.0 document", () => {
    expect(docs.full.openapi).toBe("3.1.0")
  })

  it("documents routes under their composed surface prefix", () => {
    for (const p of Object.keys(docs.admin.paths ?? {})) {
      expect(p.startsWith("/v1/admin")).toBe(true)
    }
    for (const p of Object.keys(docs.storefront.paths ?? {})) {
      expect(p.startsWith("/v1/public")).toBe(true)
    }
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

  it("has no stale or missing committed per-module files", () => {
    expect(committedPerModuleFiles()).toEqual(Object.keys(perModule).sort())
  })

  for (const [name, doc] of Object.entries(perModule)) {
    it(`${name} matches the committed artifact (no drift)`, () => {
      let committed: string
      try {
        committed = readFileSync(join(OUT_DIR, name), "utf8")
      } catch {
        throw new Error(
          `${name} is missing — run \`pnpm --filter operator generate:openapi\` and commit it.`,
        )
      }
      expect(
        serialize(doc),
        `${name} is out of date — run \`pnpm --filter operator generate:openapi\` and commit the result.`,
      ).toBe(committed)
    })
  }
})
