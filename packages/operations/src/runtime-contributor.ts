import { catalogOperationsRuntimeExtensionPort } from "@voyant-travel/catalog/runtime-contracts"
import { catalogOperationsRuntimeExtension } from "./catalog-runtime-extension.js"

export function createOperationsRuntimePortContribution(
  _host: object,
): Readonly<Record<string, unknown>> {
  return { [catalogOperationsRuntimeExtensionPort.id]: catalogOperationsRuntimeExtension }
}
