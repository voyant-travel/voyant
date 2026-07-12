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

/** Package-owned registration map for Legal deployment adapters. */
export function createLegalRuntimePortContribution(
  contribution: LegalRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return {
    [legalRuntimePort.id]: contribution.legal,
    [legalContractDocumentRuntimePort.id]: contribution.contractDocument,
    [legalBookingContractSubscriberRuntimePort.id]: contribution.bookingContractSubscriber,
  }
}
