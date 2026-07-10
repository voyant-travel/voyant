import { describe, expect, it } from "vitest"
import { flightsDemoVoyantPlugin } from "./voyant.js"

describe("flights demo deployment manifest", () => {
  it("declares the selected plugin graph id without unsupported facets", () => {
    expect(flightsDemoVoyantPlugin).toEqual({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/plugin-flights-demo",
      packageName: "@voyant-travel/plugin-flights-demo",
      localId: "plugin-flights-demo",
      meta: { ownership: "package" },
    })
  })
})
