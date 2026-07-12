import type { QuotesProposalRuntime, QuotesRuntime, QuotesSnapshotRuntime } from "./runtime-port.js"
import {
  quotesProposalRuntimePort,
  quotesRuntimePort,
  quotesSnapshotRuntimePort,
} from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface QuotesRuntimePortContribution {
  quotes: RuntimePortValue<QuotesRuntime>
  proposal: RuntimePortValue<QuotesProposalRuntime>
  snapshot: RuntimePortValue<QuotesSnapshotRuntime>
}

/** Package-owned registration map for Quotes deployment adapters. */
export function createQuotesRuntimePortContribution(
  contribution: QuotesRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return {
    [quotesRuntimePort.id]: contribution.quotes,
    [quotesProposalRuntimePort.id]: contribution.proposal,
    [quotesSnapshotRuntimePort.id]: contribution.snapshot,
  }
}
