import { describe, expect, it } from "vitest"
import { sanityCmsVoyantPlugin } from "../../src/voyant.js"

describe("Sanity CMS deployment manifest", () => {
  it("declares the selected plugin graph id without unsupported facets", () => {
    expect(sanityCmsVoyantPlugin).toEqual({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/plugin-sanity-cms",
      packageName: "@voyant-travel/plugin-sanity-cms",
      localId: "plugin-sanity-cms",
      meta: { ownership: "package" },
    })
  })
})
