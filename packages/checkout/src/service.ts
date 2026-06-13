import {
  type BootstrappedCheckoutCollection,
  bootstrapCheckoutCollection as bootstrapFinanceCheckoutCollection,
  type CheckoutBankTransferDetails,
  type CheckoutCollectionPlan,
  type CheckoutNotificationDelivery,
  type CheckoutNotificationDispatcher,
  type CheckoutPaymentStarter,
  type CheckoutPaymentStarterContext,
  type CheckoutPolicyOptions,
  type CheckoutProviderStartResult,
  type CheckoutRuntimeOptions,
  type InitiatedCheckoutCollection,
  initiateCheckoutCollection as initiateFinanceCheckoutCollection,
  previewCheckoutCollection,
  resolvePaymentSessionTarget,
} from "@voyantjs/finance/checkout"
import type { NotificationService } from "@voyantjs/notifications"
import { notificationsService } from "@voyantjs/notifications"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type {
  BootstrapCheckoutCollectionInput,
  InitiateCheckoutCollectionInput,
} from "./validation.js"

export type {
  CheckoutReminderRunList,
  CheckoutReminderRunSummary,
} from "./service-reminder-runs.js"
export { listBookingReminderRuns } from "./service-reminder-runs.js"
export {
  type BootstrappedCheckoutCollection,
  type CheckoutBankTransferDetails,
  type CheckoutCollectionPlan,
  type CheckoutPaymentStarter,
  type CheckoutPaymentStarterContext,
  type CheckoutPolicyOptions,
  type CheckoutProviderStartResult,
  type CheckoutRuntimeOptions,
  type InitiatedCheckoutCollection,
  previewCheckoutCollection,
  resolvePaymentSessionTarget,
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
    id: delivery.id,
    templateSlug: delivery.templateSlug,
    channel: delivery.channel,
    provider: delivery.provider,
    status: delivery.status,
    toAddress: delivery.toAddress,
    subject: delivery.subject,
    sentAt: optionalDateTime(delivery.sentAt),
    failedAt: optionalDateTime(delivery.failedAt),
    errorMessage: delivery.errorMessage,
  }
}

export function notificationDispatcherFor(
  dispatcher: NotificationService | undefined,
): CheckoutNotificationDispatcher | null {
  if (!dispatcher) return null

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
}

export function initiateCheckoutCollection(
  db: PostgresJsDatabase,
  bookingId: string,
  input: InitiateCheckoutCollectionInput,
  options: CheckoutPolicyOptions = {},
  dispatcher?: NotificationService,
  runtime: CheckoutRuntimeOptions = {},
): Promise<InitiatedCheckoutCollection | null> {
  return initiateFinanceCheckoutCollection(db, bookingId, input, options, {
    ...runtime,
    notificationDispatcher:
      runtime.notificationDispatcher ?? notificationDispatcherFor(dispatcher) ?? null,
  })
}

export function bootstrapCheckoutCollection(
  db: PostgresJsDatabase,
  input: BootstrapCheckoutCollectionInput,
  options: CheckoutPolicyOptions = {},
  dispatcher?: NotificationService,
  runtime: CheckoutRuntimeOptions = {},
): Promise<BootstrappedCheckoutCollection | null> {
  return bootstrapFinanceCheckoutCollection(db, input, options, {
    ...runtime,
    notificationDispatcher:
      runtime.notificationDispatcher ?? notificationDispatcherFor(dispatcher) ?? null,
  })
}
