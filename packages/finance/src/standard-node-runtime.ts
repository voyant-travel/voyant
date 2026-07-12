import {
  resolveAccommodationBookingPaymentPolicy,
  resolveAccommodationEntityPaymentPolicy,
} from "@voyant-travel/accommodations/payment-policy-runtime"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import {
  resolveCruiseBookingPaymentPolicy,
  resolveCruiseEntityPaymentPolicy,
  resolveCruiseSupplierId,
} from "@voyant-travel/cruises/payment-policy-runtime"
import {
  resolveBookingSupplierPaymentPolicy,
  resolveSupplierPaymentPolicyById,
} from "@voyant-travel/distribution/payment-policy-runtime"
import { lazyProvider } from "@voyant-travel/hono"
import {
  createInventoryPaymentPolicyRuntime,
  readPolicySourceFromInternalNotes,
  stampPolicySourceOnBooking,
} from "@voyant-travel/inventory/booking-payment-policy-runtime"
import {
  createNotificationService,
  type NotificationProvider,
  notificationsService,
} from "@voyant-travel/notifications"
import {
  resolveBookingTaxSettings,
  resolveOperatorDefaultPaymentPolicy,
  updateBookingTaxSettings,
} from "@voyant-travel/operator-settings"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { CheckoutNotificationDelivery } from "./checkout/index.js"
import type { CheckoutReminderRunRecord } from "./checkout-validation.js"
import {
  createVoyantDataFxExchangeRateResolver,
  type ResolveInvoiceExchangeRate,
} from "./invoice-fx.js"
import type { FinanceRuntimePortContribution } from "./runtime-contributor.js"

/** Build the standard Node Finance runtime from domain-neutral host resources. */
export async function createFinanceStandardNodeRuntime(
  primitives: VoyantRuntimeHostPrimitives,
): Promise<FinanceRuntimePortContribution> {
  const paymentPolicy = createPaymentPolicyRuntime()
  return {
    finance: {
      resolveDocumentDownloadUrl: primitives.storage.downloadUrl,
      resolveInvoiceExchangeRateResolver: (bindings) =>
        createExchangeRateResolver(primitives, bindings),
      resolveInvoiceSettlementPollers: (bindings) =>
        resolveInvoiceSettlementPollers(primitives, bindings),
      invoiceDueDateResolver: ({ issueDate, dueDate, bookingPaymentSchedule }) =>
        bookingPaymentSchedule && dueDate < issueDate ? issueDate : dueDate,
      resolveNotificationDispatcher: (bindings) => {
        const providers = resolveNotificationProviders(primitives, bindings)
        if (providers.length === 0) return null
        const dispatcher = createNotificationService(providers)
        return {
          sendInvoiceNotification: async (db, invoiceId, input) =>
            toCheckoutNotificationDelivery(
              await notificationsService.sendInvoiceNotification(db, dispatcher, invoiceId, input),
            ),
          sendPaymentSessionNotification: async (db, paymentSessionId, input) =>
            toCheckoutNotificationDelivery(
              await notificationsService.sendPaymentSessionNotification(
                db,
                dispatcher,
                paymentSessionId,
                input,
              ),
            ),
        }
      },
      resolvePaymentStarters: () => ({
        netopia: lazyProvider(async () =>
          import("@voyant-travel/plugin-netopia").then((module) =>
            module.createNetopiaCheckoutStarter(),
          ),
        ),
      }),
      resolveBookingTaxSettings,
      updateBookingTaxSettings,
      resolveBankTransferDetails: (bindings) =>
        resolveBankTransferDetails(primitives.env(bindings)),
      resolvePublicCheckoutBaseUrl: (bindings) =>
        resolvePublicCheckoutBaseUrl(primitives.env(bindings)),
      listBookingReminderRuns: async (db, bookingId, query) => {
        const result = await notificationsService.listReminderRuns(db, {
          bookingId,
          status: query.status,
          limit: query.limit,
          offset: query.offset,
        })
        return {
          data: result.data.map(toCheckoutReminderRun),
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        }
      },
    },
    bookingSchedule: {
      options: {
        resolveDb: (context) => primitives.database.fromContext(context),
        resolveOperatorDefaultPaymentPolicy,
        ...paymentPolicy,
        stampPolicySourceOnBooking,
        readPolicySourceFromInternalNotes,
      },
      withDb: (bindings, operation) =>
        primitives.database.transaction(bindings, (database) =>
          operation(database as PostgresJsDatabase),
        ),
    },
    bookingTax: { resolveBookingTaxSettings, updateBookingTaxSettings },
  }
}

function createPaymentPolicyRuntime() {
  return createInventoryPaymentPolicyRuntime({
    resolveSupplierPolicy: resolveBookingSupplierPaymentPolicy,
    resolveSupplierPolicyById: resolveSupplierPaymentPolicyById,
    resolveVerticalListingPolicy: async (db, bookingId) =>
      (await resolveCruiseBookingPaymentPolicy(db, bookingId)) ??
      resolveAccommodationBookingPaymentPolicy(db, bookingId),
    resolveVerticalListingPolicyForEntity: async (db, context) =>
      (await resolveCruiseEntityPaymentPolicy(db, context)) ??
      resolveAccommodationEntityPaymentPolicy(db, context),
    resolveVerticalSupplierPolicyForEntity: async (db, context) => {
      const supplierId = await resolveCruiseSupplierId(db, context)
      return supplierId ? resolveSupplierPaymentPolicyById(db, supplierId) : null
    },
  })
}

function resolveNotificationProviders(
  primitives: VoyantRuntimeHostPrimitives,
  bindings: unknown,
): ReadonlyArray<NotificationProvider> {
  const resolver = primitives.config.read(bindings, "notificationProviders")
  return typeof resolver === "function" ? resolver(primitives.env(bindings)) : []
}

function createExchangeRateResolver(
  primitives: VoyantRuntimeHostPrimitives,
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

function resolveInvoiceSettlementPollers(
  primitives: VoyantRuntimeHostPrimitives,
  bindings: unknown,
) {
  const resolver = primitives.config.read(bindings, "invoiceSettlementPollers")
  return typeof resolver === "function" ? resolver(bindings) : {}
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

type NotificationDeliveryLike = {
  id: string
  templateSlug: string | null
  channel: "email" | "sms"
  provider: string
  status: "pending" | "sent" | "failed" | "cancelled"
  toAddress: string
  subject: string | null
  sentAt: Date | string | null
  failedAt: Date | string | null
  errorMessage: string | null
}

function optionalDateTime(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

function toCheckoutNotificationDelivery(
  delivery: NotificationDeliveryLike | null,
): CheckoutNotificationDelivery | null {
  if (!delivery) return null
  return {
    ...delivery,
    sentAt: optionalDateTime(delivery.sentAt),
    failedAt: optionalDateTime(delivery.failedAt),
  }
}

function toCheckoutReminderRun(run: {
  id: string
  reminderRuleId: string
  reminderRule: { slug: string; name: string; channel: "email" | "sms"; provider: string | null }
  targetType: CheckoutReminderRunRecord["targetType"]
  targetId: string
  links: {
    bookingId: string | null
    paymentSessionId: string | null
    notificationDeliveryId: string | null
  }
  status: CheckoutReminderRunRecord["status"]
  delivery?: {
    status: CheckoutReminderRunRecord["deliveryStatus"]
    channel: "email" | "sms"
    provider: string | null
  } | null
  recipient: string | null
  scheduledFor: Date | string
  processedAt: Date | string | null
  errorMessage: string | null
  createdAt: Date | string
}): CheckoutReminderRunRecord {
  return {
    id: run.id,
    reminderRuleId: run.reminderRuleId,
    reminderRuleSlug: run.reminderRule.slug,
    reminderRuleName: run.reminderRule.name,
    targetType: run.targetType,
    targetId: run.targetId,
    bookingId: run.links.bookingId,
    paymentSessionId: run.links.paymentSessionId,
    notificationDeliveryId: run.links.notificationDeliveryId,
    status: run.status,
    deliveryStatus: run.delivery?.status ?? null,
    channel: run.delivery?.channel ?? run.reminderRule.channel,
    provider: run.delivery?.provider ?? run.reminderRule.provider ?? null,
    recipient: run.recipient,
    scheduledFor: optionalDateTime(run.scheduledFor) ?? "",
    processedAt: optionalDateTime(run.processedAt) ?? "",
    errorMessage: run.errorMessage,
    relativeDaysFromDueDate: null,
    createdAt: optionalDateTime(run.createdAt) ?? "",
  }
}

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}
