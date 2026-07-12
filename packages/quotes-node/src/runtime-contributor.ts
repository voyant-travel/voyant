import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type {
  QuotesProposalRuntime,
  QuotesRuntime,
  QuotesSnapshotRuntime,
} from "@voyant-travel/quotes"
import {
  quotesProposalRuntimePort,
  quotesRuntimePort,
  quotesSnapshotRuntimePort,
} from "@voyant-travel/quotes"

export interface QuotesNodeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  capabilities: {
    createTripsRoutesOptions(): Pick<
      QuotesProposalRuntime,
      "reserveTripDeps" | "startCheckoutDeps" | "cancelTripComponentsDeps"
    >
  }
}

/** Contribute standard Node Quotes adapters selected by the framework BOM. */
export function createQuotesNodeRuntimePortContribution(
  host: QuotesNodeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./standard-node-runtime.js").then((module) =>
    module.createQuotesStandardNodeRuntime(host),
  )
  return {
    [quotesRuntimePort.id]: runtime.then((value) => value.quotes),
    [quotesProposalRuntimePort.id]: runtime.then((value) => value.proposal),
    [quotesSnapshotRuntimePort.id]: runtime.then((value) => value.snapshot),
  }
}

export interface QuotesNodeRuntimeContribution {
  quotes: QuotesRuntime
  proposal: QuotesProposalRuntime
  snapshot: QuotesSnapshotRuntime
}
