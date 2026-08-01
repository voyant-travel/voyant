import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const admin = readFileSync(new URL("../../openapi/admin/products.json", import.meta.url), "utf8")
const authoring = readFileSync(
  new URL("../../openapi/admin/inventory-authoring.json", import.meta.url),
  "utf8",
)

describe("product family OpenAPI artifacts", () => {
  it.each([
    ["admin products", admin],
    ["inventory authoring", authoring],
  ])("publishes classification fields in %s", (_name, document) => {
    expect(document).toContain('"productSubtypeCode"')
    expect(document).toContain('"durationMinutes"')
  })

  it("documents immutable family codes on update", () => {
    const parsed = JSON.parse(admin) as {
      paths: Record<string, { patch?: { requestBody?: unknown } }>
    }
    const update = parsed.paths["/v1/admin/products/product-types/{typeId}"]?.patch
    expect(JSON.stringify(update?.requestBody)).not.toContain('"code"')
  })
})
