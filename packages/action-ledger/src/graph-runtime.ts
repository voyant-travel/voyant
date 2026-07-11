import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"

import { createActionLedgerHealthHonoExtension } from "./health-routes.js"
import { actionLedgerHealthRuntimePort } from "./runtime-port.js"

export const createActionLedgerHealthVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) =>
    createActionLedgerHealthHonoExtension(await getPort(actionLedgerHealthRuntimePort)),
)

export { actionLedgerHealthRuntimePort } from "./runtime-port.js"
