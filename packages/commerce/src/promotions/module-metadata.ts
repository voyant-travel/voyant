import type { Module } from "@voyant-travel/core"

import {
  bulkReindexProductsWorkflowManifest,
  promotionAffectedAllFilter,
} from "./workflow-bulk-reindex-manifest.js"

export const promotionsModule: Module = {
  name: "promotions",
  workflows: [bulkReindexProductsWorkflowManifest],
  eventFilters: [promotionAffectedAllFilter],
}
