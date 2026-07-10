import { defineModule } from "@voyant-travel/core/project"

const promotionAffectedAllFilter = {
  eventType: "promotion.changed",
  id: "ef_6f8e4b4ce409d04c",
  input: {
    object: {
      offerId: { path: "data.offerId" },
      source: { path: "data.source" },
    },
  },
  payloadHash: "6f8e4b4ce409d04c",
  targetWorkflowId: "promotions.reindex-all-products",
  where: {
    eq: [{ path: "data.affected.kind" }, { lit: "all" }],
  },
} as const

/** Import-cheap deployment declaration owned by the commerce package. */
export const commerceVoyantModule = defineModule({
  id: "@voyant-travel/commerce",
  packageName: "@voyant-travel/commerce",
  localId: "commerce",
  api: [
    {
      id: "@voyant-travel/commerce#api.admin",
      surface: "admin",
      mount: "@voyant-travel/commerce",
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "createCommerceHonoModules",
      },
    },
    {
      id: "@voyant-travel/commerce#api.public",
      surface: "public",
      mount: "@voyant-travel/commerce",
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "createCommerceHonoModules",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/commerce#schema",
      source: "@voyant-travel/commerce/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/commerce#migrations",
      source: "./migrations",
    },
  ],
  events: [
    {
      id: "@voyant-travel/commerce#event.promotion.changed",
      eventType: "promotion.changed",
    },
  ],
  subscribers: [
    {
      id: "@voyant-travel/commerce#subscriber.ef_6f8e4b4ce409d04c",
      eventType: "promotion.changed",
      eventFilterId: promotionAffectedAllFilter.id,
      workflowId: "promotions.reindex-all-products",
      filter: promotionAffectedAllFilter,
      source: "@voyant-travel/commerce/promotions/workflow-bulk-reindex-manifest",
    },
  ],
  workflows: [
    {
      id: "promotions.reindex-all-products",
      config: {
        defaultRuntime: "node",
      },
      source: "@voyant-travel/commerce/promotions/workflow-bulk-reindex",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default commerceVoyantModule
