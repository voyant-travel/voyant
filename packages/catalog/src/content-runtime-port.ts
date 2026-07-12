import { definePort } from "@voyant-travel/core/project"

import type { SourceAdapterRegistry } from "./booking-engine/index.js"

export interface CatalogContentRuntime {
  resolveRegistry(context: unknown): SourceAdapterRegistry | Promise<SourceAdapterRegistry>
}

/** Host capability shared by package-owned sourced-content route factories. */
export const catalogContentRuntimePort = definePort<CatalogContentRuntime>({
  id: "catalog.content-runtime",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.resolveRegistry !== "function"
    ) {
      throw new Error("catalog.content-runtime provider must implement resolveRegistry().")
    }
  },
})
