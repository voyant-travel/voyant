import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildFrameworkOpenApiDocuments } from "./generate.js"

/**
 * Drift gate for the published framework spec (voyant#2114).
 *
 * Regenerates the documents from the framework composition and asserts they
 * match the committed `spec/*.json` shipped by this package. Any framework
 * module route change that wasn't regenerated fails CI. Refresh with:
 *   pnpm --filter @voyant-travel/openapi generate
 */
const SPEC_DIR = join(process.cwd(), "spec")
const docs = buildFrameworkOpenApiDocuments()
const artifacts = {
  "framework-openapi.json": docs.full,
  "framework-admin.json": docs.admin,
  "framework-storefront.json": docs.storefront,
}
const serialize = (doc: unknown) => `${JSON.stringify(doc, null, 2)}\n`

if (process.env.UPDATE_OPENAPI) {
  mkdirSync(SPEC_DIR, { recursive: true })
  for (const [name, doc] of Object.entries(artifacts)) {
    writeFileSync(join(SPEC_DIR, name), serialize(doc))
  }
}

describe("framework openapi spec", () => {
  it("generates a 3.1.0 document", () => {
    expect(docs.full.openapi).toBe("3.1.0")
  })

  for (const [name, doc] of Object.entries(artifacts)) {
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
})
