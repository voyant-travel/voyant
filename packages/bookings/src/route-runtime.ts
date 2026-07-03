import type { CustomFieldRegistryResolver } from "@voyant-travel/core/custom-fields"
import { createKmsProviderFromEnv, type KmsProvider } from "@voyant-travel/utils"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { BookingTravelerSnapshot } from "./pii.js"
import type { KmsBindings } from "./routes-shared.js"
import type { BookingStatus } from "./state-machine.js"

export const BOOKING_ROUTE_RUNTIME_CONTAINER_KEY = "runtime.bookings.routes"

/**
 * Resolver invoked by the booking-traveler "with travel details"
 * route when `data.personId` is provided. Returns a plaintext
 * snapshot of the linked person's dietary / accessibility / primary
 * passport values, decrypted server-side via the same KMS provider
 * the route already resolved. Templates wire this from
 * `relationshipsService.loadPersonTravelSnapshot` so the bookings package
 * stays free of any direct CRM dependency.
 */
export type ResolveBookingTravelSnapshot = (
  db: PostgresJsDatabase,
  personId: string,
  ctx: { kms: KmsProvider },
) => Promise<BookingTravelerSnapshot | null>

/**
 * Best-effort contact snapshot the booking-session bootstrap + update
 * flows hand to the caller's person resolver. Mirrors the storefront
 * lead-intake `StorefrontLeadContact` shape so the same resolver can
 * service both surfaces.
 */
export interface BookingPersonResolverContact {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  preferredLanguage: string | null
}

/**
 * Resolves (or upserts) a CRM person from a booking's billing contact
 * snapshot. Returns the resolved person id, or `null` to leave the
 * booking's `person_id` unset. Templates wire this from
 * `relationshipsService.upsertPersonFromContact` so the bookings package stays
 * free of any direct CRM dependency — see issue #961.
 */
export type ResolveBookingBillingPerson = (
  db: PostgresJsDatabase,
  contact: BookingPersonResolverContact,
  ctx: { bookingId: string; source: string; sourceRef: string },
) => Promise<string | null>

/**
 * Resolves (or upserts) a CRM person from a booking traveler payload.
 * Called from `publicBookingsService.createSession` /
 * `updateSession` per-traveler so storefront-originated bookings
 * produce CRM person links per traveler (not just for the billing
 * contact). Returns the resolved person id, or `null` to keep
 * `booking_travelers.person_id` unset.
 */
export type ResolveBookingTravelerPerson = (
  db: PostgresJsDatabase,
  contact: BookingPersonResolverContact,
  ctx: { bookingId: string; source: string; sourceRef: string },
) => Promise<string | null>

export type ResolveBookingBillingPersonById = (
  db: PostgresJsDatabase,
  personId: string,
) => Promise<boolean>

export type ResolveBookingBillingOrganizationById = (
  db: PostgresJsDatabase,
  organizationId: string,
) => Promise<boolean>

export type ClosePaymentSchedulesForBooking = (
  db: PostgresJsDatabase,
  bookingId: string,
  status: Extract<BookingStatus, "cancelled" | "expired">,
) => Promise<void> | void

export type RecordCancellationFinancialSettlement = (
  db: PostgresJsDatabase,
  input: {
    bookingId: string
    bookingNumber: string
    previousStatus: Extract<
      BookingStatus,
      "draft" | "on_hold" | "awaiting_payment" | "confirmed" | "in_progress"
    >
    reason: string | null
    actorId: string
  },
) =>
  | Promise<Record<string, unknown> | null | undefined>
  | Record<string, unknown>
  | null
  | undefined

export interface BookingRouteRuntime {
  getKmsProvider(): Promise<KmsProvider>
  resolveTravelSnapshot?: ResolveBookingTravelSnapshot
  resolveBillingPerson?: ResolveBookingBillingPerson
  resolveTravelerPerson?: ResolveBookingTravelerPerson
  resolveBillingPersonById?: ResolveBookingBillingPersonById
  resolveBillingOrganizationById?: ResolveBookingBillingOrganizationById
  closePaymentSchedulesForBooking?: ClosePaymentSchedulesForBooking
  recordCancellationFinancialSettlement?: RecordCancellationFinancialSettlement
  /** Deployment custom-field registry — validates `customFields` on write. */
  customFields?: CustomFieldRegistryResolver
}

/**
 * Hook for apps that source their KMS key material from somewhere other than
 * env vars / wrangler secrets — e.g. Voyant Cloud Vault. Receives the same
 * resolved bindings the default env-driven provider would, returns the
 * provider (sync or async). When omitted, falls back to
 * `createKmsProviderFromEnv` so existing starter wiring keeps working.
 */
export type ResolveBookingKmsProvider = (
  env: Record<string, string | undefined>,
) => KmsProvider | Promise<KmsProvider>

export interface BookingRouteRuntimeOptions {
  resolveKmsProvider?: ResolveBookingKmsProvider
  resolveTravelSnapshot?: ResolveBookingTravelSnapshot
  resolveBillingPerson?: ResolveBookingBillingPerson
  resolveTravelerPerson?: ResolveBookingTravelerPerson
  resolveBillingPersonById?: ResolveBookingBillingPersonById
  resolveBillingOrganizationById?: ResolveBookingBillingOrganizationById
  closePaymentSchedulesForBooking?: ClosePaymentSchedulesForBooking
  recordCancellationFinancialSettlement?: RecordCancellationFinancialSettlement
  customFields?: CustomFieldRegistryResolver
}

function buildRuntimeEnv(bindings: KmsBindings): Record<string, string | undefined> {
  const processEnv =
    (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> }
      }
    ).process?.env ?? {}

  return {
    ...processEnv,
    ...(bindings ?? {}),
  }
}

export function buildBookingRouteRuntime(
  bindings: KmsBindings,
  options: BookingRouteRuntimeOptions = {},
): BookingRouteRuntime {
  const runtimeEnv = buildRuntimeEnv(bindings)

  return {
    async getKmsProvider() {
      if (options.resolveKmsProvider) {
        return options.resolveKmsProvider(runtimeEnv)
      }
      return createKmsProviderFromEnv(runtimeEnv)
    },
    resolveTravelSnapshot: options.resolveTravelSnapshot,
    resolveBillingPerson: options.resolveBillingPerson,
    resolveTravelerPerson: options.resolveTravelerPerson,
    resolveBillingPersonById: options.resolveBillingPersonById,
    resolveBillingOrganizationById: options.resolveBillingOrganizationById,
    closePaymentSchedulesForBooking: options.closePaymentSchedulesForBooking,
    recordCancellationFinancialSettlement: options.recordCancellationFinancialSettlement,
    customFields: options.customFields,
  }
}
