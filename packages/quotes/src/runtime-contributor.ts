import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { VoyantPort } from "@voyant-travel/core/project"
import { checkoutInquiryRuntimePort } from "@voyant-travel/quotes-contracts/checkout-inquiry"
import { tripsRoutesRuntimePort } from "@voyant-travel/trips/voyant"
import { createCheckoutInquiryRuntime } from "./checkout-inquiry-runtime.js"
import { createQuotesRuntime } from "./runtime.js"
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
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}

/** Contribute standard Node Quotes adapters selected by the framework BOM. */
export function createQuotesRuntimePortContribution(
  host: QuotesRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const checkoutInquiry = createCheckoutInquiryRuntime()
  const runtime = Promise.resolve()
    .then(() => host.getRuntimePort(tripsRoutesRuntimePort))
    .then((tripsRoutes) => createQuotesRuntime(host, tripsRoutes))
  return {
    [checkoutInquiryRuntimePort.id]: checkoutInquiry,
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
