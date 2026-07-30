import { definePort } from "@voyant-travel/core/project"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { BookingsApiModuleOptions } from "./index.js"
import type { BookingsExpireStaleHoldsJobRuntime } from "./job-runtime.js"
import type { BookingRequirementsApiModuleOptions } from "./requirements/index.js"
import type { ResolveBookingRequirementsProductSnapshot } from "./requirements/service-public.js"
import type {
  BookingOverviewItemEnricher,
  BookingPersonResolverContact,
  ResolveBookingTravelSnapshot,
} from "./route-runtime.js"

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
/**
 * Durable creation of one booking from a public draft and quote.
 *
 * Bookings owns the `/v1/public/bookings` resource, but Finance owns the
 * durable create command that composes a booking together with its payment
 * schedules, tax lines, and documents — and Finance depends on Bookings, not
 * the reverse. So the route lives here and the command arrives through this
 * port, the same way `bookings.finance.runtime` already inverts that edge.
 *
 * Consumed optionally: a deployment without a provider serves no public
 * creation route, which is the fail-closed posture the selected graph's
 * create action already declares.
 */
export interface BookingsSelfServiceCreateRuntime {
  createFromDraft(input: {
    db: PostgresJsDatabase
    draftId: string
    quoteId: string
    /** Proven identity: an account, or a contact a challenge verified. */
    caller: { personId?: string; verifiedEmail?: string; verifiedPhone?: string }
    /** Stable request key; the durable command claims against it. */
    idempotencyKey: string
    /** Ledger principal for a guest, who has no user account. */
    fallbackPrincipalId: string
    /** Session correlation for a guest — the challenge that authorized this. */
    sessionId?: string
    /**
     * Runs inside the create transaction, so anything spent here commits or
     * rolls back with the booking.
     */
    consumeSources?(tx: PostgresJsDatabase, bookingId: string): Promise<void>
  }): Promise<BookingsSelfServiceCreateResult>
}

export type BookingsSelfServiceCreateResult =
  | { status: "ok"; bookingId: string; bookingNumber: string }
  | { status: "rejected"; reason: string }

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
export const bookingsSelfServiceCreateRuntimePort = objectPort<BookingsSelfServiceCreateRuntime>(
  "bookings.self-service-create.runtime",
  ["createFromDraft"],
)
