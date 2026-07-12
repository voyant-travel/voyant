import { definePort } from "@voyant-travel/core/project"

import type { ActionLedgerDriftCheck } from "./health-routes.js"

export interface ActionLedgerBookingDriftRuntime {
  checkBookingDrift: ActionLedgerDriftCheck
}

export interface ActionLedgerFinanceDriftRuntime {
  checkFinanceDrift: ActionLedgerDriftCheck
}

export interface ActionLedgerInventoryDriftRuntime {
  checkProductDrift: ActionLedgerDriftCheck
}

function driftRuntimeTest(method: string) {
  return (provider: unknown) => {
    if (provider === null || typeof provider !== "object") {
      throw new Error(`action-ledger drift provider must be an object implementing ${method}().`)
    }
    if (typeof (provider as Readonly<Record<string, unknown>>)[method] !== "function") {
      throw new Error(`action-ledger drift provider must implement ${method}().`)
    }
  }
}

export const actionLedgerBookingDriftRuntimePort = definePort<ActionLedgerBookingDriftRuntime>({
  id: "action-ledger.booking-drift-runtime",
  test: driftRuntimeTest("checkBookingDrift"),
})

export const actionLedgerFinanceDriftRuntimePort = definePort<ActionLedgerFinanceDriftRuntime>({
  id: "action-ledger.finance-drift-runtime",
  test: driftRuntimeTest("checkFinanceDrift"),
})

export const actionLedgerInventoryDriftRuntimePort = definePort<ActionLedgerInventoryDriftRuntime>({
  id: "action-ledger.inventory-drift-runtime",
  test: driftRuntimeTest("checkProductDrift"),
})
