import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"

import type { CatalogRuntimeExtensions } from "../runtime-contracts.js"

const CATALOG_RUNTIME_EXTENSION_MODULES = {
  accommodations: [
    "@voyant-travel/accommodations/catalog-runtime-extension",
    "catalogAccommodationsRuntimeExtension",
  ],
  charters: [
    "@voyant-travel/charters/catalog-runtime-extension",
    "catalogChartersRuntimeExtension",
  ],
  commerce: [
    "@voyant-travel/commerce/catalog-runtime-extension",
    "catalogCommerceRuntimeExtension",
  ],
  distribution: [
    "@voyant-travel/distribution/catalog-runtime-extension",
    "catalogDistributionRuntimeExtension",
  ],
  cruises: ["@voyant-travel/cruises/catalog-runtime-extension", "catalogCruisesRuntimeExtension"],
  inventory: [
    "@voyant-travel/inventory/catalog-runtime-extension",
    "catalogInventoryRuntimeExtension",
  ],
  operations: [
    "@voyant-travel/operations/catalog-runtime-extension",
    "catalogOperationsRuntimeExtension",
  ],
  catalogDemo: [
    "@voyant-travel/plugin-catalog-demo/catalog-runtime-extension",
    "catalogDemoRuntimeExtension",
  ],
} as const

export async function loadCatalogRuntimeExtensions(
  modules: VoyantRuntimeHostPrimitives["modules"],
): Promise<CatalogRuntimeExtensions> {
  const entries = await Promise.all(
    Object.entries(CATALOG_RUNTIME_EXTENSION_MODULES).map(
      async ([key, [specifier, exportName]]) => {
        const imported = await modules.import(specifier)
        const extension = imported[exportName]
        if (!extension || typeof extension !== "object") {
          throw new Error(`Catalog runtime extension ${specifier} must export ${exportName}.`)
        }
        return [key, extension] as const
      },
    ),
  )
  return Object.fromEntries(entries) as unknown as CatalogRuntimeExtensions
}
