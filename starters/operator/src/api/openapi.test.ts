import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildOperatorOpenApiDocuments } from "./openapi.js"

/**
 * Generates the operator OpenAPI artifacts from the composed app and verifies
 * the chain end-to-end (voyant#2114): a module route authored with
 * `createRoute(...).openapi(...)` shows up in the generated document at its real
 * composed path, proving `createVoyantApp` → `mountApp` (now `OpenAPIHono`) →
 * doc generation works through the real framework.
 *
 * Writing the JSON here doubles as the build-time generator; once the drift gate
 * lands this becomes "generated === committed".
 */
const OUT_DIR = join(process.cwd(), "openapi")

describe("operator openapi generation", () => {
  const docs = buildOperatorOpenApiDocuments()

  it("writes the surface artifacts", () => {
    mkdirSync(OUT_DIR, { recursive: true })
    writeFileSync(
      join(OUT_DIR, "framework-openapi.json"),
      `${JSON.stringify(docs.full, null, 2)}\n`,
    )
    writeFileSync(join(OUT_DIR, "framework-admin.json"), `${JSON.stringify(docs.admin, null, 2)}\n`)
    writeFileSync(
      join(OUT_DIR, "framework-storefront.json"),
      `${JSON.stringify(docs.storefront, null, 2)}\n`,
    )
    expect(docs.full.openapi).toBe("3.1.0")
  })

  it("includes the markets tracer route generated from createRoute()", () => {
    // markets is on the legacy `/v1/*` surface, so it lands in the full doc.
    const marketsPath = Object.keys(docs.full.paths ?? {}).find((p) => p.endsWith("/markets"))
    expect(marketsPath, "expected a generated path ending in /markets").toBeDefined()
    const op = docs.full.paths?.[marketsPath as string]?.get
    expect(op).toBeDefined()
    const schema = op?.responses?.["200"]?.content?.["application/json"]?.schema as
      | { properties?: Record<string, unknown> }
      | undefined
    expect(Object.keys(schema?.properties ?? {})).toEqual(
      expect.arrayContaining(["data", "total", "limit", "offset"]),
    )
  })

  it("splits surfaces by prefix", () => {
    for (const p of Object.keys(docs.admin.paths ?? {}))
      expect(p.startsWith("/v1/admin")).toBe(true)
    for (const p of Object.keys(docs.storefront.paths ?? {}))
      expect(p.startsWith("/v1/public")).toBe(true)
  })
})
