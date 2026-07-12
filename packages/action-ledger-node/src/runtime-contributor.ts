import { actionLedgerHealthRuntimePort } from "@voyant-travel/action-ledger/graph-runtime"

/** Supply Action Ledger health through the standard Node target adapter. */
export function createActionLedgerNodeRuntimePortContribution(
  _host: unknown,
): Readonly<Record<string, unknown>> {
  return {
    [actionLedgerHealthRuntimePort.id]: import("./standard-node-runtime.js").then((runtime) =>
      runtime.createActionLedgerStandardNodeRuntime(),
    ),
  }
}
