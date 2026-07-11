import type { Module } from "@voyant-travel/core"
import { definePort } from "@voyant-travel/core/project"

import type { ProductBrochureRoutesOptions } from "./routes-brochure.js"
import type { ProductContentHonoExtensionOptions } from "./routes-content.js"

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

export const inventoryContentRuntimePort = definePort<ProductContentHonoExtensionOptions>({
  id: "inventory.content-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("inventory.content-runtime provider must be an options object.")
    }
    for (const surface of ["admin", "public"] as const) {
      if (typeof provider[surface]?.resolveRegistry !== "function") {
        throw new Error(
          `inventory.content-runtime provider must configure ${surface}.resolveRegistry().`,
        )
      }
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
