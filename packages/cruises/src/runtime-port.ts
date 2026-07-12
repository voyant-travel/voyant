import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import { definePort } from "@voyant-travel/core/project"

export interface CruisesRoutesRuntime {
  resolveSourceAdapterRegistry(bindings: unknown): Promise<SourceAdapterRegistry>
}

/** Deployment connector registry consumed by package-owned Cruise routes. */
export const cruisesRoutesRuntimePort = definePort<CruisesRoutesRuntime>({
  id: "cruises.routes-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("cruises.routes-runtime provider must be an options object.")
    }
    if (typeof provider.resolveSourceAdapterRegistry !== "function") {
      throw new Error(
        "cruises.routes-runtime provider must implement resolveSourceAdapterRegistry().",
      )
    }
  },
})
