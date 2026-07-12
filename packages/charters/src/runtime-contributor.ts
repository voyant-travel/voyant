import { catalogChartersRuntimeExtensionPort } from "@voyant-travel/catalog/runtime-contracts"
import { catalogChartersRuntimeExtension } from "./catalog-runtime-extension.js"

export function createChartersRuntimePortContribution(
  _host: object,
): Readonly<Record<string, unknown>> {
  return { [catalogChartersRuntimeExtensionPort.id]: catalogChartersRuntimeExtension }
}
