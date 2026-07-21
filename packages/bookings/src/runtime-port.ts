import { definePort } from "@voyant-travel/core/project"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { BookingsApiModuleOptions } from "./index.js"
import type { BookingRequirementsApiModuleOptions } from "./requirements/index.js"
import type { ResolveBookingRequirementsProductSnapshot } from "./requirements/service-public.js"
import type {
  BookingOverviewItemEnricher,
  BookingPersonResolverContact,
  ResolveBookingTravelSnapshot,
} from "./route-runtime.js"
import type { BookingsExpireStaleHoldsJobRuntime } from "./job-runtime.js"

export interface BookingsRuntimeProvider {
  options: BookingsApiModuleOptions
}

export interface BookingsAccommodationRuntime {
  enrichOverviewItems: BookingOverviewItemEnricher
}

export interface BookingsFinanceRuntime {
  createStaleBookingHoldsJobRuntime(options: {
    resolveDb: () => PostgresJsDatabase | Promise<PostgresJsDatabase>
    userId?: string
  }): BookingsExpireStaleHoldsJobRuntime
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
  },
})
export const bookingRequirementsRuntimePort = objectPort<BookingRequirementsApiModuleOptions>(
  "bookings.requirements.runtime",
)
export const bookingsAccommodationRuntimePort = objectPort<BookingsAccommodationRuntime>(
  "bookings.accommodation.runtime",
  ["enrichOverviewItems"],
)
export const bookingsFinanceRuntimePort = objectPort<BookingsFinanceRuntime>(
  "bookings.finance.runtime",
  ["createStaleBookingHoldsJobRuntime"],
)
export const bookingsInventoryRuntimePort = objectPort<BookingsInventoryRuntime>(
  "bookings.inventory.runtime",
  ["resolveProductSnapshot"],
)
export const bookingsRelationshipsRuntimePort = objectPort<BookingsRelationshipsRuntime>(
  "bookings.relationships.runtime",
  ["loadPersonTravelSnapshot", "upsertPersonFromContact", "getPersonById", "getOrganizationById"],
)
