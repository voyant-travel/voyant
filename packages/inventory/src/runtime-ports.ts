import type { Module } from "@voyant-travel/core"
import { definePort } from "@voyant-travel/core/project"

import type { ProductBrochureRoutesOptions } from "./routes-brochure.js"

export interface InventoryRuntime {
  bootstrap: NonNullable<Module["bootstrap"]>
}

export const inventoryRuntimePort = definePort<InventoryRuntime>({
  id: "inventory.runtime",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.bootstrap !== "function"
    ) {
      throw new Error("inventory.runtime provider must implement bootstrap().")
    }
  },
})

export const inventoryBrochureRuntimePort = definePort<ProductBrochureRoutesOptions>({
  id: "inventory.brochure-runtime",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.resolveStorage !== "function"
    ) {
      throw new Error("inventory.brochure-runtime provider must implement resolveStorage().")
    }
  },
})
