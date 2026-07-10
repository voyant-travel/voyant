import { describe, expect, it } from "vitest"
import { catalogVoyantModule } from "../../src/voyant.js"

describe("catalog deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(catalogVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/catalog",
      packageName: "@voyant-travel/catalog",
      api: [
        {
          id: "@voyant-travel/catalog#api.admin",
          surface: "admin",
          runtime: {
            entry: "@voyant-travel/catalog",
            export: "createCatalogSearchHonoModule",
          },
        },
        {
          id: "@voyant-travel/catalog#api.public",
          surface: "public",
          anonymous: true,
          runtime: {
            entry: "@voyant-travel/catalog",
            export: "createCatalogSearchHonoModule",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/catalog#schema" }],
      migrations: [{ id: "@voyant-travel/catalog#migrations" }],
    })
  })
})
