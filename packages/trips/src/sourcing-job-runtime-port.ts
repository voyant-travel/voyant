import type { OwnedAvailabilitySearchHandlerRegistry } from "@voyant-travel/catalog"
import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import { definePort } from "@voyant-travel/core/project"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export interface TripsSourcingJobRuntime {
  resolveDb(bindings: unknown): PostgresJsDatabase | Promise<PostgresJsDatabase>
  resolveSourceRegistry(bindings: unknown): SourceAdapterRegistry | Promise<SourceAdapterRegistry>
  resolveOwnedSearchHandlers(
    bindings: unknown,
  ): OwnedAvailabilitySearchHandlerRegistry | Promise<OwnedAvailabilitySearchHandlerRegistry>
  warn(message: string): void
}

export const tripsSourcingJobRuntimePort = definePort<TripsSourcingJobRuntime>({
  id: "trips.sourcing-job-runtime",
  test(runtime) {
    if (
      !runtime ||
      typeof runtime.resolveDb !== "function" ||
      typeof runtime.resolveSourceRegistry !== "function" ||
      typeof runtime.resolveOwnedSearchHandlers !== "function" ||
      typeof runtime.warn !== "function"
    ) {
      throw new Error("trips.sourcing-job-runtime provider is incomplete.")
    }
  },
})
