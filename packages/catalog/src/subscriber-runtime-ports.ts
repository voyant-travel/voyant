import { definePort } from "@voyant-travel/core/project"

import type { CatalogBookingSnapshotRuntime } from "./booking-snapshot-subscriber-runtime.js"
import type { CatalogProjectionRuntime } from "./projection-runtime.js"

/** Host adapter that creates a projection runtime from bootstrap bindings. */
export interface CatalogProjectionRuntimeProvider {
  createRuntime(bindings: unknown): CatalogProjectionRuntime | Promise<CatalogProjectionRuntime>
}

export interface CatalogBookingSnapshotRuntimeProvider {
  createRuntime(
    bindings: unknown,
  ): CatalogBookingSnapshotRuntime | Promise<CatalogBookingSnapshotRuntime>
}

export const catalogProjectionRuntimePort = definePort<CatalogProjectionRuntimeProvider>({
  id: "catalog.projection-runtime",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.createRuntime !== "function"
    ) {
      throw new Error("catalog.projection-runtime provider must implement createRuntime().")
    }
  },
})

export const catalogBookingSnapshotRuntimePort = definePort<CatalogBookingSnapshotRuntimeProvider>({
  id: "catalog.booking-snapshot-runtime",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.createRuntime !== "function"
    ) {
      throw new Error("catalog.booking-snapshot-runtime provider must implement createRuntime().")
    }
  },
})
