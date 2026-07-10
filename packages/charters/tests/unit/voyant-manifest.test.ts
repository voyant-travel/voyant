import { describe, expect, it } from "vitest"
import { chartersVoyantModule } from "../../src/voyant.js"

describe("charters deployment manifest", () => {
  it("owns schema, migrations, and linkables without operator route wiring", () => {
    expect(chartersVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/charters",
      packageName: "@voyant-travel/charters",
      schema: [{ id: "@voyant-travel/charters#schema", source: "@voyant-travel/charters/schema" }],
      migrations: [{ id: "@voyant-travel/charters#migrations", source: "./migrations" }],
      links: [
        { id: "@voyant-travel/charters#linkable.charter_product" },
        { id: "@voyant-travel/charters#linkable.charter_voyage" },
        { id: "@voyant-travel/charters#linkable.charter_yacht" },
      ],
    })
    expect(chartersVoyantModule.api).toBeUndefined()
  })
})
