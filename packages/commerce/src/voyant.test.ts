import { describe, expect, it } from "vitest"

import {
  bulkReindexProductsWorkflowManifest,
  promotionAffectedAllFilter,
} from "./promotions/workflow-bulk-reindex-manifest.js"
import { commerceVoyantModule } from "./voyant.js"

describe("commerce deployment manifest", () => {
  it("owns the promotion workflow and event-filter runtime references", () => {
    expect(commerceVoyantModule.workflows).toEqual([
      {
        id: "commerce.process-promotion-boundaries",
        config: {
          defaultRuntime: "node",
          schedule: { cron: "*/5 * * * *", name: "every-5-minutes" },
        },
        source: "@voyant-travel/commerce/promotion-boundary-workflow",
        runtime: {
          entry: "@voyant-travel/commerce/promotion-boundary-workflow",
          export: "promotionBoundarySchedulerWorkflow",
        },
      },
      {
        ...bulkReindexProductsWorkflowManifest,
        source: "@voyant-travel/commerce/product-reindex-workflow",
        runtime: {
          entry: "@voyant-travel/commerce/product-reindex-workflow",
          export: "bulkReindexProductsWorkflow",
        },
      },
    ])
    expect(commerceVoyantModule.subscribers).toEqual([
      {
        id: "@voyant-travel/commerce#subscriber.promotion-redemption-booking-confirmed",
        eventType: "booking.confirmed",
        source: "@voyant-travel/commerce/promotion-redemption-subscriber",
        runtime: {
          entry: "@voyant-travel/commerce/promotion-redemption-subscriber",
          export: "createPromotionRedemptionSubscriberGraphRuntime",
        },
      },
      {
        id: `@voyant-travel/commerce#subscriber.${promotionAffectedAllFilter.id}`,
        eventType: promotionAffectedAllFilter.eventType,
        eventFilterId: promotionAffectedAllFilter.id,
        workflowId: bulkReindexProductsWorkflowManifest.id,
        filter: promotionAffectedAllFilter.manifest,
        source: "@voyant-travel/commerce/product-reindex-workflow-manifest",
        runtime: {
          entry: "@voyant-travel/commerce/product-reindex-workflow-manifest",
          export: "promotionAffectedAllFilter",
        },
      },
    ])
    expect(promotionAffectedAllFilter).toMatchObject({
      id: "ef_6f8e4b4ce409d04c",
      manifest: {
        payloadHash: "6f8e4b4ce409d04c",
        targetWorkflowId: "promotions.reindex-all-products",
      },
    })
  })
})
