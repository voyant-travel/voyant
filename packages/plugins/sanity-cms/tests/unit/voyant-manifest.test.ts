import { describe, expect, it } from "vitest"
import { sanityCmsVoyantPlugin } from "../../src/voyant.js"

describe("Sanity CMS deployment manifest", () => {
  it("declares its default subscribers and admitted configuration", () => {
    expect(sanityCmsVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/plugin-sanity-cms",
      packageName: "@voyant-travel/plugin-sanity-cms",
      localId: "plugin-sanity-cms",
      subscribers: [
        { eventType: "product.created", source: "@voyant-travel/plugin-sanity-cms" },
        { eventType: "product.updated", source: "@voyant-travel/plugin-sanity-cms" },
        { eventType: "product.deleted", source: "@voyant-travel/plugin-sanity-cms" },
      ],
      config: [
        { key: "projectId", required: true },
        { key: "dataset", required: true },
        { key: "documentType", required: true },
        { key: "apiVersion", default: "2024-01-01" },
        { key: "voyantIdField", default: "voyantId" },
        { key: "apiHost", default: "api.sanity.io" },
        { key: "events.created", default: "product.created" },
        { key: "events.updated", default: "product.updated" },
        { key: "events.deleted", default: "product.deleted" },
      ],
      secrets: [{ key: "token", required: true, rotation: "replace-only" }],
      meta: { ownership: "package" },
    })
  })
})
