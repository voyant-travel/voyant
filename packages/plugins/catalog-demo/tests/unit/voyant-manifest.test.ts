import { describe, expect, it } from "vitest"
import { catalogDemoVoyantPlugin } from "../../src/voyant.js"

describe("catalog demo deployment manifest", () => {
  it("declares the selected plugin graph id without unsupported facets", () => {
    expect(catalogDemoVoyantPlugin).toEqual({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/plugin-catalog-demo",
      packageName: "@voyant-travel/plugin-catalog-demo",
      localId: "plugin-catalog-demo",
      meta: { ownership: "package" },
    })
  })
})
