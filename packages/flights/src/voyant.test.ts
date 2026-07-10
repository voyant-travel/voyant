import { describe, expect, it } from "vitest"
import { flightsVoyantModule } from "./voyant.js"

describe("flights deployment manifest", () => {
  it("owns its injectable runtime, schema, and migrations", () => {
    expect(flightsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/flights",
      packageName: "@voyant-travel/flights",
      api: [
        {
          id: "@voyant-travel/flights#api",
          surface: "admin",
          mount: "@voyant-travel/flights",
          runtime: {
            entry: "@voyant-travel/flights/hono",
            export: "createFlightsHonoModule",
          },
        },
      ],
      schema: [
        {
          id: "@voyant-travel/flights#schema",
          source: "@voyant-travel/flights/reference/local-postgres",
        },
      ],
      migrations: [{ id: "@voyant-travel/flights#migrations", source: "./migrations" }],
    })
  })
})
