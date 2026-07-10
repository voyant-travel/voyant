import { describe, expect, it } from "vitest"
import { createFlightsHonoModule } from "./hono.js"
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
          mount: "flights",
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

  it("declares only the existing non-transactional admin surface", () => {
    expect(flightsVoyantModule.api).toEqual([
      {
        id: "@voyant-travel/flights#api",
        surface: "admin",
        mount: "flights",
        runtime: {
          entry: "@voyant-travel/flights/hono",
          export: "createFlightsHonoModule",
        },
      },
    ])

    const runtime = createFlightsHonoModule({
      resolveAdapter: () => {
        throw new Error("not used by the manifest test")
      },
    })
    expect(runtime.module).toEqual({ name: "flights" })
    expect(runtime.adminRoutes).toBeDefined()
    expect(runtime.publicRoutes).toBeUndefined()
    expect(runtime.webhookRoutes).toBeUndefined()
  })
})
