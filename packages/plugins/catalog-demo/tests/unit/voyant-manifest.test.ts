import { describe, expect, it } from "vitest"
import { catalogDemoVoyantPlugin } from "../../src/voyant.js"

describe("catalog demo deployment manifest", () => {
  it("declares its HTTP adapter provider and configuration", () => {
    expect(catalogDemoVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/plugin-catalog-demo",
      packageName: "@voyant-travel/plugin-catalog-demo",
      localId: "plugin-catalog-demo",
      provides: { ports: [{ id: "catalog.source-adapter" }] },
      config: [
        { id: "@voyant-travel/plugin-catalog-demo#config.base-url", required: true },
        { id: "@voyant-travel/plugin-catalog-demo#config.verticals", default: ["products"] },
        { id: "@voyant-travel/plugin-catalog-demo#config.timeout-ms", default: 8000 },
      ],
      providers: [
        {
          id: "@voyant-travel/plugin-catalog-demo#provider.source-adapter",
          port: "catalog.source-adapter",
          runtime: {
            entry: "@voyant-travel/plugin-catalog-demo",
            export: "createDemoCatalogAdapter",
          },
        },
      ],
      meta: { ownership: "package" },
    })
  })
})
