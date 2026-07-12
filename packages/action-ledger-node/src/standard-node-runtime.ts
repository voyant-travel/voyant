import type { ActionLedgerHealthRoutesOptions } from "@voyant-travel/action-ledger/health"
import { checkBookingActionLedgerDrift } from "@voyant-travel/bookings/action-ledger-drift"
import { checkFinanceActionLedgerDrift } from "@voyant-travel/finance/action-ledger-drift"
import { checkProductActionLedgerDrift } from "@voyant-travel/inventory/action-ledger-drift"

/** Compose the standard Node Action Ledger health checks without cycling the domain package. */
export function createActionLedgerStandardNodeRuntime(): ActionLedgerHealthRoutesOptions {
  return {
    checkBookingDrift: checkBookingActionLedgerDrift,
    checkFinanceDrift: checkFinanceActionLedgerDrift,
    checkProductDrift: checkProductActionLedgerDrift,
  }
}
