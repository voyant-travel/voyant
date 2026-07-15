import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"

import { createActionLedgerHealthApiExtension } from "./health-routes.js"
import {
  actionLedgerBookingDriftRuntimePort,
  actionLedgerFinanceDriftRuntimePort,
  actionLedgerInventoryDriftRuntimePort,
} from "./runtime-port.js"

export const createActionLedgerHealthVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) => {
    const [bookings, finance, inventory] = await Promise.all([
      getPort(actionLedgerBookingDriftRuntimePort),
      getPort(actionLedgerFinanceDriftRuntimePort),
      getPort(actionLedgerInventoryDriftRuntimePort),
    ])
    return createActionLedgerHealthApiExtension({ ...bookings, ...finance, ...inventory })
  },
)

export {
  actionLedgerBookingDriftRuntimePort,
  actionLedgerFinanceDriftRuntimePort,
  actionLedgerInventoryDriftRuntimePort,
} from "./runtime-port.js"
