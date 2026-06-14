import type { BookingPiiService } from "@voyant-travel/bookings"
import type { EventBus } from "@voyant-travel/core"
import type { StorageProvider } from "@voyant-travel/storage"

import type { ContractLifecycleHook } from "./lifecycle.js"
import type { ContractDocumentGenerator, ContractsRouteOptions } from "./routes.js"

export type ContractsRouteRuntime = {
  documentGenerator?: ContractDocumentGenerator
  documentStorage?: StorageProvider | null
  resolveDocumentDownloadUrl?: ContractsRouteOptions["resolveDocumentDownloadUrl"]
  eventBus?: EventBus
  lifecycleHooks?: readonly ContractLifecycleHook[]
  bookingPiiService?: BookingPiiService | null
  resolveBookingPiiService?: ContractsRouteOptions["resolveBookingPiiService"]
}

export const CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY = "providers.legal.contracts.runtime"

export function buildContractsRouteRuntime(
  bindings: Record<string, unknown>,
  options: ContractsRouteOptions = {},
): ContractsRouteRuntime {
  return {
    documentGenerator: options.resolveDocumentGenerator?.(bindings) ?? options.documentGenerator,
    documentStorage: options.resolveDocumentStorage?.(bindings) ?? options.documentStorage,
    resolveDocumentDownloadUrl: options.resolveDocumentDownloadUrl,
    eventBus: options.resolveEventBus?.(bindings) ?? options.eventBus,
    lifecycleHooks: options.resolveLifecycleHooks?.(bindings) ?? options.lifecycleHooks,
    bookingPiiService: options.bookingPiiService,
    resolveBookingPiiService: options.resolveBookingPiiService,
  }
}
