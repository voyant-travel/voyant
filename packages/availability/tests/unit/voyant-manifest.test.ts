import { describe, expect, it } from "vitest"

import { availabilityVoyantModule } from "../../src/voyant.js"

describe("availability deployment manifest", () => {
  it("owns the package schema and migrations", () => {
    expect(availabilityVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/availability",
      packageName: "@voyant-travel/availability",
      schema: [
        {
          id: "@voyant-travel/availability#schema",
          source: "@voyant-travel/availability/schema",
        },
      ],
      migrations: [
        {
          id: "@voyant-travel/availability#migrations",
          source: "./migrations",
        },
      ],
    })
    expect(availabilityVoyantModule.access).toBeUndefined()
  })
})
