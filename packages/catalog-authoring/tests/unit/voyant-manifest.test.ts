import { describe, expect, it } from "vitest"

import { catalogAuthoringVoyantModule } from "../../src/voyant.js"

describe("catalog-authoring deployment manifest", () => {
  it("owns the package schema and migrations", () => {
    expect(catalogAuthoringVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/catalog-authoring",
      packageName: "@voyant-travel/catalog-authoring",
      schema: [
        {
          id: "@voyant-travel/catalog-authoring#schema",
          source: "@voyant-travel/catalog-authoring/schema",
        },
      ],
      migrations: [
        {
          id: "@voyant-travel/catalog-authoring#migrations",
          source: "./migrations",
        },
      ],
    })
    expect(catalogAuthoringVoyantModule.access).toBeUndefined()
  })
})
