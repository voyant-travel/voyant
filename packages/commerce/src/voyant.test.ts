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
        ...bulkReindexProductsWorkflowManifest,
        source: "@voyant-travel/commerce/promotions/workflow-bulk-reindex",
        runtime: {
          entry: "./promotions/workflow-bulk-reindex",
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
          entry: "./promotion-redemption-subscriber",
          export: "createPromotionRedemptionSubscriberGraphRuntime",
        },
      },
      {
        id: `@voyant-travel/commerce#subscriber.${promotionAffectedAllFilter.id}`,
        eventType: promotionAffectedAllFilter.eventType,
        eventFilterId: promotionAffectedAllFilter.id,
        workflowId: bulkReindexProductsWorkflowManifest.id,
        filter: promotionAffectedAllFilter.manifest,
        source: "@voyant-travel/commerce/promotions/workflow-bulk-reindex-manifest",
        runtime: {
          entry: "./promotions/workflow-bulk-reindex-manifest",
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
