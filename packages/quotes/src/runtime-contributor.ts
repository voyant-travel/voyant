import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import {
  type QuotesProposalRuntime,
  type QuotesRuntime,
  type QuotesSnapshotRuntime,
  quotesProposalRuntimePort,
  quotesRuntimePort,
  quotesSnapshotRuntimePort,
} from "./runtime-port.js"

export interface QuotesRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  capabilities: {
    createTripsRoutesOptions(): Pick<
      QuotesProposalRuntime,
      "reserveTripDeps" | "startCheckoutDeps" | "cancelTripComponentsDeps"
    >
  }
}

/** Contribute standard Node Quotes adapters selected by the framework BOM. */
export function createQuotesRuntimePortContribution(
  host: QuotesRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./runtime.js").then((module) => module.createQuotesRuntime(host))
  return {
    [quotesRuntimePort.id]: runtime.then((value) => value.quotes),
    [quotesProposalRuntimePort.id]: runtime.then((value) => value.proposal),
    [quotesSnapshotRuntimePort.id]: runtime.then((value) => value.snapshot),
  }
}

export interface QuotesRuntimeContribution {
  quotes: QuotesRuntime
  proposal: QuotesProposalRuntime
  snapshot: QuotesSnapshotRuntime
}
