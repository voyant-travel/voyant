import { describe, expect, it } from "vitest"
import { commerceVoyantModule } from "../../src/voyant.js"

describe("commerce deployment manifest", () => {
  it("owns runtime, persistence, and promotion orchestration facets", () => {
    expect(commerceVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/commerce",
      packageName: "@voyant-travel/commerce",
      api: [
        {
          id: "@voyant-travel/commerce#api.admin",
          surface: "admin",
          runtime: {
            entry: "@voyant-travel/commerce",
            export: "createCommerceHonoModules",
          },
        },
        {
          id: "@voyant-travel/commerce#api.public",
          surface: "public",
          runtime: {
            entry: "@voyant-travel/commerce",
            export: "createCommerceHonoModules",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/commerce#schema" }],
      migrations: [{ id: "@voyant-travel/commerce#migrations" }],
      events: [
        {
          id: "@voyant-travel/commerce#event.promotion.changed",
          eventType: "promotion.changed",
        },
      ],
      workflows: [
        {
          id: "promotions.reindex-all-products",
          config: { defaultRuntime: "node" },
        },
      ],
      subscribers: [
        {
          id: "@voyant-travel/commerce#subscriber.ef_6f8e4b4ce409d04c",
          eventType: "promotion.changed",
          eventFilterId: "ef_6f8e4b4ce409d04c",
          workflowId: "promotions.reindex-all-products",
          filter: {
            where: {
              eq: [{ path: "data.affected.kind" }, { lit: "all" }],
            },
          },
        },
      ],
    })
  })
})
