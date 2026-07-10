import { describe, expect, it } from "vitest"
import { flightsDemoVoyantPlugin } from "./voyant.js"

describe("flights demo deployment manifest", () => {
  it("declares its HTTP connector provider and configuration", () => {
    expect(flightsDemoVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/plugin-flights-demo",
      packageName: "@voyant-travel/plugin-flights-demo",
      localId: "plugin-flights-demo",
      provides: { ports: [{ id: "flights.connector-adapter" }] },
      config: [{ id: "@voyant-travel/plugin-flights-demo#config.base-url", required: true }],
      providers: [
        {
          id: "@voyant-travel/plugin-flights-demo#provider.connector-adapter",
          port: "flights.connector-adapter",
          runtime: {
            entry: "@voyant-travel/plugin-flights-demo",
            export: "createDemoFlightAdapter",
          },
        },
      ],
      meta: { ownership: "package" },
    })
  })
})
