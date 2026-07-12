import { catalogDemoRuntimeExtensionPort } from "@voyant-travel/catalog/runtime-contracts"
import { catalogDemoRuntimeExtension } from "./catalog-runtime-extension.js"

export function createCatalogDemoRuntimePortContribution(
  _host: object,
): Readonly<Record<string, unknown>> {
  return { [catalogDemoRuntimeExtensionPort.id]: catalogDemoRuntimeExtension }
}
