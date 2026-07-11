import { definePort } from "@voyant-travel/core/project"

import type { ActionLedgerHealthRoutesOptions } from "./health-routes.js"

export const actionLedgerHealthRuntimePort = definePort<ActionLedgerHealthRoutesOptions>({
  id: "action-ledger.health-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("action-ledger.health-runtime provider must be an options object.")
    }
    for (const method of ["checkBookingDrift", "checkFinanceDrift", "checkProductDrift"] as const) {
      if (typeof provider[method] !== "function") {
        throw new Error(`action-ledger.health-runtime provider must implement ${method}().`)
      }
    }
  },
})
