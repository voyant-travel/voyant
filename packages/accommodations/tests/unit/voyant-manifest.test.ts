import { describe, expect, it } from "vitest"
import { accommodationsVoyantModule } from "../../src/voyant.js"

describe("accommodations deployment manifest", () => {
  it("owns its runtime, schema, migrations, and linkable", () => {
    expect(accommodationsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/accommodations",
      packageName: "@voyant-travel/accommodations",
      api: [
        {
          id: "@voyant-travel/accommodations#api",
          surface: "admin",
          mount: "@voyant-travel/accommodations",
          transactional: true,
          runtime: {
            entry: "@voyant-travel/accommodations",
            export: "accommodationsHonoModule",
          },
        },
      ],
      schema: [
        {
          id: "@voyant-travel/accommodations#schema",
          source: "@voyant-travel/accommodations/schema",
        },
      ],
      migrations: [{ id: "@voyant-travel/accommodations#migrations", source: "./migrations" }],
      links: [
        {
          id: "@voyant-travel/accommodations#linkable.roomBlock",
          source: "@voyant-travel/accommodations/linkables",
        },
      ],
    })
  })
})
