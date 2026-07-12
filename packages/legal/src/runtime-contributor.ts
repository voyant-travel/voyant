import { commerceLegalRuntimePort } from "@voyant-travel/commerce/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { createCommerceLegalRuntime } from "./commerce-runtime.js"
import { legalContractDocumentRuntimePort } from "./contract-document-runtime-port.js"
import { legalBookingContractSubscriberRuntimePort } from "./contracts/booking-contract-subscriber-runtime.js"
import { legalRuntimePort } from "./runtime-port.js"

export interface LegalRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Register the complete standard Node Legal runtime from domain-neutral host primitives. */
export function createLegalRuntimePortContribution(
  host: LegalRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./runtime.js").then((module) =>
    module.createLegalRuntime(host.primitives),
  )
  return {
    [commerceLegalRuntimePort.id]: createCommerceLegalRuntime(host.primitives),
    [legalRuntimePort.id]: runtime.then((value) => value.legal),
    [legalContractDocumentRuntimePort.id]: runtime.then((value) => value.contractDocument),
    [legalBookingContractSubscriberRuntimePort.id]: runtime.then(
      (value) => value.bookingContractSubscriber,
    ),
  }
}
