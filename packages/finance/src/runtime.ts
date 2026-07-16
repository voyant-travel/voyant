import type { CustomFieldsRuntime } from "@voyant-travel/core/custom-fields"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { FinanceApiModuleOptions } from "./index.js"
import {
  createVoyantDataFxExchangeRateResolver,
  type ResolveInvoiceExchangeRate,
} from "./invoice-fx.js"
import type {
  FinanceAccommodationsPaymentPolicyRuntime,
  FinanceBookingScheduleRuntime,
  FinanceCheckoutPaymentStartersRuntime,
  FinanceCruisesPaymentPolicyRuntime,
  FinanceDistributionPaymentPolicyRuntime,
  FinanceHostRuntime,
  FinanceInventoryPaymentPolicyRuntime,
  FinanceInvoiceSettlementPollerProvider,
  FinanceNotificationsRuntime,
  FinanceOperatorSettingsRuntime,
} from "./runtime-port.js"
import type { InvoiceSettlementPoller } from "./service-settlement.js"

/** Compose Finance's main HTTP runtime from generic host and selected providers. */
export function createFinanceRuntime(
  host: FinanceHostRuntime,
  customFields: CustomFieldsRuntime,
  notifications: FinanceNotificationsRuntime,
  checkoutPaymentStarters?: FinanceCheckoutPaymentStartersRuntime,
  invoiceSettlementPollerProviders: readonly FinanceInvoiceSettlementPollerProvider[] = [],
): FinanceApiModuleOptions {
  const { primitives } = host
  return {
    resolveDocumentDownloadUrl: primitives.storage.downloadUrl,
    resolveCustomFields: async (db, invoice) => {
      if (invoice.organizationId) {
        return customFields.resolveVisibleValues(
          db,
          "organization",
          invoice.organizationId,
          "invoice",
        )
      }
      if (invoice.personId) {
        return customFields.resolveVisibleValues(db, "person", invoice.personId, "invoice")
      }
      return {}
    },
    resolveInvoiceExchangeRateResolver: (bindings) =>
      createExchangeRateResolver(primitives, bindings),
    invoiceSettlementPollers: aggregateFinanceInvoiceSettlementPollers(
      invoiceSettlementPollerProviders,
    ),
    invoiceDueDateResolver: ({ issueDate, dueDate, bookingPaymentSchedule }) =>
      bookingPaymentSchedule && dueDate < issueDate ? issueDate : dueDate,
    resolveNotificationDispatcher: notifications.resolveNotificationDispatcher,
    resolvePaymentStarters: (bindings) =>
      checkoutPaymentStarters?.resolvePaymentStarters(bindings) ?? {},
    resolveBankTransferDetails: (bindings) => resolveBankTransferDetails(primitives.env(bindings)),
    resolvePublicCheckoutBaseUrl: (bindings) =>
      resolvePublicCheckoutBaseUrl(primitives.env(bindings)),
    listBookingReminderRuns: notifications.listBookingReminderRuns,
  }
}

/** Compose Finance's payment schedule from statically selected domain providers. */
export function createFinanceBookingScheduleRuntime(
  host: FinanceHostRuntime,
  settings: FinanceOperatorSettingsRuntime,
  distribution: FinanceDistributionPaymentPolicyRuntime,
  accommodations: FinanceAccommodationsPaymentPolicyRuntime,
  cruises: FinanceCruisesPaymentPolicyRuntime,
  inventory: FinanceInventoryPaymentPolicyRuntime,
): FinanceBookingScheduleRuntime {
  const paymentPolicy = inventory.createPaymentPolicyRuntime({
    resolveSupplierPolicy: distribution.resolveSupplierPolicy,
    resolveSupplierPolicyById: distribution.resolveSupplierPolicyById,
    resolveVerticalListingPolicy: async (db, bookingId) =>
      (await cruises.resolveBookingPolicy(db, bookingId)) ??
      accommodations.resolveBookingPolicy(db, bookingId),
    resolveVerticalListingPolicyForEntity: async (db, context) =>
      (await cruises.resolveEntityPolicy(db, context)) ??
      accommodations.resolveEntityPolicy(db, context),
    resolveVerticalSupplierPolicyForEntity: async (db, context) => {
      const supplierId = await cruises.resolveSupplierId(db, context)
      return supplierId ? distribution.resolveSupplierPolicyById(db, supplierId) : null
    },
  })
  return {
    options: {
      resolveDb: (context) => host.primitives.database.fromContext<PostgresJsDatabase>(context),
      resolveOperatorDefaultPaymentPolicy: settings.resolveOperatorDefaultPaymentPolicy,
      ...paymentPolicy,
      stampPolicySourceOnBooking: inventory.stampPolicySourceOnBooking,
      readPolicySourceFromInternalNotes: inventory.readPolicySourceFromInternalNotes,
    },
    withDb: (bindings, operation) =>
      host.primitives.database.transaction(bindings, (database) =>
        operation(database as AnyDrizzleDb),
      ),
  }
}

export function createFinanceBookingTaxRuntime(
  settings: FinanceOperatorSettingsRuntime,
): FinanceApiModuleOptions {
  return {
    resolveBookingTaxSettings: settings.resolveBookingTaxSettings,
    updateBookingTaxSettings: settings.updateBookingTaxSettings,
  }
}

function createExchangeRateResolver(
  primitives: FinanceHostRuntime["primitives"],
  bindings: unknown,
): ResolveInvoiceExchangeRate | undefined {
  const env = primitives.env(bindings)
  const apiKey =
    nonEmpty(env.VOYANT_DATA_API_KEY) ??
    (env.VOYANT_ADMIN_AUTH_MODE === "voyant-cloud"
      ? (nonEmpty(env.VOYANT_API_KEY) ?? nonEmpty(env.VOYANT_CLOUD_API_KEY))
      : undefined)
  if (!apiKey) return undefined
  return createVoyantDataFxExchangeRateResolver({
    apiKey,
    baseUrl: nonEmpty(env.VOYANT_CLOUD_API_URL),
  })
}

export function aggregateFinanceInvoiceSettlementPollers(
  providers: readonly FinanceInvoiceSettlementPollerProvider[],
): Readonly<Record<string, InvoiceSettlementPoller>> {
  const pollers: Record<string, InvoiceSettlementPoller> = {}
  for (const provider of [...providers].sort((left, right) =>
    left.provider < right.provider ? -1 : left.provider > right.provider ? 1 : 0,
  )) {
    if (Object.hasOwn(pollers, provider.provider)) {
      throw new Error(
        `Finance invoice settlement poller provider "${provider.provider}" was selected more than once.`,
      )
    }
    pollers[provider.provider] = provider.poller
  }
  return Object.freeze(pollers)
}

function resolveBankTransferDetails(env: Readonly<Record<string, unknown>>) {
  const beneficiary = stringValue(env.BANK_TRANSFER_BENEFICIARY)
  const iban = stringValue(env.BANK_TRANSFER_IBAN)
  if (!beneficiary || !iban) return null
  return {
    provider: "bank-transfer" as const,
    beneficiary,
    iban,
    bankName: stringValue(env.BANK_TRANSFER_BANK_NAME) ?? null,
    notes: stringValue(env.BANK_TRANSFER_NOTES) ?? null,
  }
}

function resolvePublicCheckoutBaseUrl(env: Readonly<Record<string, unknown>>): string | null {
  return (
    nonEmpty(env.PUBLIC_CHECKOUT_BASE_URL) ??
    nonEmpty(env.DASH_BASE_URL) ??
    nonEmpty(env.APP_URL)?.replace(/\/api\/?$/, "") ??
    null
  )
}

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}
