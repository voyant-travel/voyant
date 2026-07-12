import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { definePort } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { BookingTaxRouteOptions } from "./booking-tax.js"
import type { CheckoutRoutesOptions } from "./checkout-routes.js"
import type { CheckoutPaymentStarter } from "./checkout-service.js"
import type { PaymentPolicy } from "./payment-policy.js"
import type { PaymentPolicyEntityContext } from "./payment-policy-cascade.js"
import type { BookingScheduleRoutesOptions } from "./payment-schedule/routes.js"
import type { InvoiceSettlementPoller } from "./service-settlement.js"

type PolicyReader = (db: PostgresJsDatabase, bookingId: string) => Promise<PaymentPolicy | null>
type EntityPolicyReader = (
  db: PostgresJsDatabase,
  context: PaymentPolicyEntityContext,
) => Promise<PaymentPolicy | null>

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

export interface FinanceHostRuntime {
  primitives: VoyantRuntimeHostPrimitives
}

export interface FinanceOperatorSettingsRuntime {
  resolveOperatorDefaultPaymentPolicy: BookingScheduleRoutesOptions["resolveOperatorDefaultPaymentPolicy"]
  resolveBookingTaxSettings: NonNullable<BookingTaxRouteOptions["resolveBookingTaxSettings"]>
  updateBookingTaxSettings: NonNullable<BookingTaxRouteOptions["updateBookingTaxSettings"]>
}

export interface FinanceNotificationsRuntime {
  resolveNotificationDispatcher: NonNullable<CheckoutRoutesOptions["resolveNotificationDispatcher"]>
  listBookingReminderRuns: NonNullable<CheckoutRoutesOptions["listBookingReminderRuns"]>
}

export interface FinanceDistributionPaymentPolicyRuntime {
  resolveSupplierPolicy: PolicyReader
  resolveSupplierPolicyById(
    db: PostgresJsDatabase,
    supplierId: string,
  ): Promise<PaymentPolicy | null>
}

export interface FinanceAccommodationsPaymentPolicyRuntime {
  resolveBookingPolicy: PolicyReader
  resolveEntityPolicy: EntityPolicyReader
}

export interface FinanceCruisesPaymentPolicyRuntime {
  resolveBookingPolicy: PolicyReader
  resolveEntityPolicy: EntityPolicyReader
  resolveSupplierId(
    db: PostgresJsDatabase,
    context: PaymentPolicyEntityContext,
  ): Promise<string | null>
}

export interface FinanceInventoryPaymentPolicyRuntime {
  createPaymentPolicyRuntime(options: {
    resolveSupplierPolicy: PolicyReader
    resolveSupplierPolicyById: FinanceDistributionPaymentPolicyRuntime["resolveSupplierPolicyById"]
    resolveVerticalListingPolicy: PolicyReader
    resolveVerticalListingPolicyForEntity: EntityPolicyReader
    resolveVerticalSupplierPolicyForEntity: EntityPolicyReader
  }): Pick<
    BookingScheduleRoutesOptions,
    | "resolveSupplierPolicy"
    | "resolveCategoryPolicy"
    | "resolveListingPolicy"
    | "resolveSupplierPolicyForEntity"
    | "resolveCategoryPolicyForEntity"
    | "resolveListingPolicyForEntity"
  >
  stampPolicySourceOnBooking: BookingScheduleRoutesOptions["stampPolicySourceOnBooking"]
  readPolicySourceFromInternalNotes: BookingScheduleRoutesOptions["readPolicySourceFromInternalNotes"]
}

export interface FinanceCheckoutPaymentStartersRuntime {
  resolvePaymentStarters(bindings: Record<string, unknown>): Record<string, CheckoutPaymentStarter>
}

export interface FinanceInvoiceSettlementPollerProvider {
  provider: string
  poller: InvoiceSettlementPoller
}

export interface FinanceBookingScheduleRuntime {
  options: BookingScheduleRoutesOptions
  withDb<T>(bindings: unknown, operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
}

export const financeHostRuntimePort = objectPort<FinanceHostRuntime>("finance.host.runtime")
export const financeOperatorSettingsRuntimePort = objectPort<FinanceOperatorSettingsRuntime>(
  "finance.operator-settings.runtime",
  ["resolveOperatorDefaultPaymentPolicy", "resolveBookingTaxSettings", "updateBookingTaxSettings"],
)
export const financeNotificationsRuntimePort = objectPort<FinanceNotificationsRuntime>(
  "finance.notifications.runtime",
  ["resolveNotificationDispatcher", "listBookingReminderRuns"],
)
export const financeDistributionPaymentPolicyRuntimePort =
  objectPort<FinanceDistributionPaymentPolicyRuntime>(
    "finance.distribution-payment-policy.runtime",
    ["resolveSupplierPolicy", "resolveSupplierPolicyById"],
  )
export const financeAccommodationsPaymentPolicyRuntimePort =
  objectPort<FinanceAccommodationsPaymentPolicyRuntime>(
    "finance.accommodations-payment-policy.runtime",
    ["resolveBookingPolicy", "resolveEntityPolicy"],
  )
export const financeCruisesPaymentPolicyRuntimePort =
  objectPort<FinanceCruisesPaymentPolicyRuntime>("finance.cruises-payment-policy.runtime", [
    "resolveBookingPolicy",
    "resolveEntityPolicy",
    "resolveSupplierId",
  ])
export const financeInventoryPaymentPolicyRuntimePort =
  objectPort<FinanceInventoryPaymentPolicyRuntime>("finance.inventory-payment-policy.runtime", [
    "createPaymentPolicyRuntime",
    "stampPolicySourceOnBooking",
    "readPolicySourceFromInternalNotes",
  ])
export const financeCheckoutPaymentStartersRuntimePort =
  objectPort<FinanceCheckoutPaymentStartersRuntime>("finance.checkout-payment-starters.runtime", [
    "resolvePaymentStarters",
  ])
export const financeInvoiceSettlementPollerRuntimePort =
  definePort<FinanceInvoiceSettlementPollerProvider>({
    id: "finance.invoice-settlement-poller",
    test(provider) {
      if (
        provider === null ||
        typeof provider !== "object" ||
        typeof provider.provider !== "string" ||
        provider.provider.trim() !== provider.provider ||
        provider.provider.length === 0 ||
        typeof provider.poller !== "function"
      ) {
        throw new Error(
          "finance.invoice-settlement-poller provider must declare a canonical provider name and poller function.",
        )
      }
    },
  })
