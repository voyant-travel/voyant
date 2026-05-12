import type { EventBus } from "@voyantjs/core"
import type { StorageProvider } from "@voyantjs/storage"

import type { ContractDocumentGenerator, ContractsRouteOptions } from "./routes.js"

export type ContractsRouteRuntime = {
  documentGenerator?: ContractDocumentGenerator
  documentStorage?: StorageProvider | null
  eventBus?: EventBus
}

export const CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY = "providers.legal.contracts.runtime"

export function buildContractsRouteRuntime(
  bindings: Record<string, unknown>,
  options: ContractsRouteOptions = {},
): ContractsRouteRuntime {
  return {
    documentGenerator: options.resolveDocumentGenerator?.(bindings) ?? options.documentGenerator,
    documentStorage: options.resolveDocumentStorage?.(bindings) ?? options.documentStorage,
    eventBus: options.resolveEventBus?.(bindings) ?? options.eventBus,
  }
}
