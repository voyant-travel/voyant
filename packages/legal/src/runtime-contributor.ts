import type { ContractDocumentRoutesOptions } from "./contract-document-routes.js"
import { legalContractDocumentRuntimePort } from "./contract-document-runtime-port.js"
import {
  type LegalBookingContractSubscriberHost,
  legalBookingContractSubscriberRuntimePort,
} from "./contracts/booking-contract-subscriber-port.js"
import type { CreateLegalHonoModuleOptions } from "./index.js"
import { legalRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface LegalRuntimePortContribution {
  legal: RuntimePortValue<CreateLegalHonoModuleOptions>
  contractDocument: RuntimePortValue<ContractDocumentRoutesOptions>
  bookingContractSubscriber: RuntimePortValue<LegalBookingContractSubscriberHost>
}

export interface LegalRuntimeContributorHost {
  capabilities: {
    loadLegalRuntime(): RuntimePortValue<LegalRuntimePortContribution>
  }
}

/** Package-owned registration map for Legal deployment adapters. */
export function createLegalRuntimePortContribution(
  host: LegalRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const contribution = Promise.resolve(host.capabilities.loadLegalRuntime())
  return {
    [legalRuntimePort.id]: contribution.then((runtime) => runtime.legal),
    [legalContractDocumentRuntimePort.id]: contribution.then((runtime) => runtime.contractDocument),
    [legalBookingContractSubscriberRuntimePort.id]: contribution.then(
      (runtime) => runtime.bookingContractSubscriber,
    ),
  }
}
