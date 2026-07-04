import type { Module } from "@voyant-travel/core"

import { bulkReindexProductsWorkflow, promotionAffectedAllFilter } from "./workflow-bulk-reindex.js"

export const promotionsModule: Module = {
  name: "promotions",
  workflows: [bulkReindexProductsWorkflow],
  eventFilters: [promotionAffectedAllFilter],
}
