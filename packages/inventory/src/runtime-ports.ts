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

export type InventoryBrochureRuntime = Pick<ProductBrochureRoutesOptions, "resolvePrinter">

export const inventoryBrochureRuntimePort = definePort<InventoryBrochureRuntime>({
  id: "inventory.brochure-runtime",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.resolvePrinter !== "function"
    ) {
      throw new Error("inventory.brochure-runtime provider must implement resolvePrinter().")
    }
  },
})
