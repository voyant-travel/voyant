import type { QuotesProposalRuntime, QuotesRuntime, QuotesSnapshotRuntime } from "./runtime-port.js"
import {
  quotesProposalRuntimePort,
  quotesRuntimePort,
  quotesSnapshotRuntimePort,
} from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>
type ResolveParticipantPersonById = QuotesRuntime["resolveParticipantPersonById"]

export interface QuotesRuntimeContributorHost {
  capabilities: {
    relationshipsService: {
      getPersonById(
        db: Parameters<ResolveParticipantPersonById>[0],
        personId: string,
      ): Promise<unknown>
    }
  }
  proposal: RuntimePortValue<QuotesProposalRuntime>
  snapshot: RuntimePortValue<QuotesSnapshotRuntime>
}

/** Package-owned registration map for Quotes deployment adapters. */
export function createQuotesRuntimePortContribution(
  host: QuotesRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const quotes: QuotesRuntime = {
    resolveParticipantPersonById: async (db, personId) =>
      (await host.capabilities.relationshipsService.getPersonById(db, personId)) != null,
  }
  return {
    [quotesRuntimePort.id]: quotes,
    [quotesProposalRuntimePort.id]: host.proposal,
    [quotesSnapshotRuntimePort.id]: host.snapshot,
  }
}
