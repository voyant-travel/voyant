import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { legalBookingContractSubscriberRuntimePort } from "@voyant-travel/legal/booking-contract-subscriber"
import { legalContractDocumentRuntimePort } from "@voyant-travel/legal/contract-document-runtime-port"
import { legalRuntimePort } from "@voyant-travel/legal/runtime-port"

export interface LegalNodeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Register the complete standard Node Legal runtime from domain-neutral host primitives. */
export function createLegalNodeRuntimePortContribution(
  host: LegalNodeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./standard-node-runtime.js").then((module) =>
    module.createLegalStandardNodeRuntime(host.primitives),
  )
  return {
    [legalRuntimePort.id]: runtime.then((value) => value.legal),
    [legalContractDocumentRuntimePort.id]: runtime.then((value) => value.contractDocument),
    [legalBookingContractSubscriberRuntimePort.id]: runtime.then(
      (value) => value.bookingContractSubscriber,
    ),
  }
}
