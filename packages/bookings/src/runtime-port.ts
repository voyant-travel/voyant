import type { BootstrapContext, VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { definePort } from "@voyant-travel/core/project"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { BookingsHonoModuleOptions } from "./index.js"
import type { BookingRequirementsHonoModuleOptions } from "./requirements/index.js"
import type { ResolveBookingRequirementsProductSnapshot } from "./requirements/service-public.js"
import type {
  BookingOverviewItemEnricher,
  BookingPersonResolverContact,
  ResolveBookingTravelSnapshot,
} from "./route-runtime.js"
import type { BookingsExpireStaleHoldsWorkflowRuntime } from "./workflow-runtime.js"

export interface BookingsRuntimeProvider {
  options: BookingsHonoModuleOptions
  registerWorkflowService?(context: BootstrapContext): Promise<void> | void
}

export interface BookingsConfigurationRuntime {
  readConfig: VoyantRuntimeHostPrimitives["config"]["read"]
}

export interface BookingsAccommodationRuntime {
  enrichOverviewItems: BookingOverviewItemEnricher
}

export interface BookingsFinanceRuntime {
  createStaleBookingHoldsRuntime(options: {
    resolveDb: () => PostgresJsDatabase | Promise<PostgresJsDatabase>
    userId?: string
  }): BookingsExpireStaleHoldsWorkflowRuntime
}

export interface BookingsInventoryRuntime {
  resolveProductSnapshot: ResolveBookingRequirementsProductSnapshot
}

export interface BookingsRelationshipsRuntime {
  loadPersonTravelSnapshot: ResolveBookingTravelSnapshot
  upsertPersonFromContact(
    db: PostgresJsDatabase,
    contact: BookingPersonResolverContact,
    options: { source: string; sourceRef: string; requireContactPoint?: boolean },
  ): Promise<{ id: string } | null>
  getPersonById(db: PostgresJsDatabase, personId: string): Promise<unknown | null>
  getOrganizationById(db: PostgresJsDatabase, organizationId: string): Promise<unknown | null>
}

function objectPort<T extends object>(id: string, methods: readonly string[] = []) {
  return definePort<T>({
    id,
    test(provider) {
      if (provider === null || typeof provider !== "object") {
        throw new Error(`${id} provider must be an object.`)
      }
      for (const method of methods) {
        if (typeof Reflect.get(provider, method) !== "function") {
          throw new Error(`${id} provider must implement ${method}().`)
        }
      }
    },
  })
}

export const bookingsRuntimePort = definePort<BookingsRuntimeProvider>({
  id: "bookings.runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object" || !provider.options) {
      throw new Error("bookings.runtime provider must supply module options.")
    }
    if (
      provider.registerWorkflowService !== undefined &&
      typeof provider.registerWorkflowService !== "function"
    ) {
      throw new Error("bookings.runtime registerWorkflowService must be a function.")
    }
  },
})
export const bookingRequirementsRuntimePort = objectPort<BookingRequirementsHonoModuleOptions>(
  "bookings.requirements.runtime",
)
export const bookingsConfigurationRuntimePort = objectPort<BookingsConfigurationRuntime>(
  "bookings.configuration.runtime",
  ["readConfig"],
)
export const bookingsAccommodationRuntimePort = objectPort<BookingsAccommodationRuntime>(
  "bookings.accommodation.runtime",
  ["enrichOverviewItems"],
)
export const bookingsFinanceRuntimePort = objectPort<BookingsFinanceRuntime>(
  "bookings.finance.runtime",
  ["createStaleBookingHoldsRuntime"],
)
export const bookingsInventoryRuntimePort = objectPort<BookingsInventoryRuntime>(
  "bookings.inventory.runtime",
  ["resolveProductSnapshot"],
)
export const bookingsRelationshipsRuntimePort = objectPort<BookingsRelationshipsRuntime>(
  "bookings.relationships.runtime",
  ["loadPersonTravelSnapshot", "upsertPersonFromContact", "getPersonById", "getOrganizationById"],
)
