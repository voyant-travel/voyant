import { describe, expect, it } from "vitest"
import { cruisesVoyantModule } from "../../src/voyant.js"

describe("cruises deployment manifest", () => {
  it("owns schema, migrations, and linkables without operator route wiring", () => {
    expect(cruisesVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/cruises",
      packageName: "@voyant-travel/cruises",
      schema: [{ id: "@voyant-travel/cruises#schema", source: "@voyant-travel/cruises/schema" }],
      migrations: [{ id: "@voyant-travel/cruises#migrations", source: "./migrations" }],
      links: [
        { id: "@voyant-travel/cruises#linkable.cruise" },
        { id: "@voyant-travel/cruises#linkable.cruise_voyage_group" },
        { id: "@voyant-travel/cruises#linkable.cruise_sailing" },
        { id: "@voyant-travel/cruises#linkable.cruise_ship" },
      ],
    })
    expect(cruisesVoyantModule.api).toBeUndefined()
  })
})
