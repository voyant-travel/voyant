import type { ModuleContainer, SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { NotificationService } from "./service.js"
import {
  type BookingDocumentAttachmentResolver,
  bookingDocumentNotificationsService,
} from "./service-booking-documents.js"
import {
  bookingIsPaidInFullForNotification,
  dispatchReminderEventRules,
} from "./service-reminders.js"

export const NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY = "notifications.subscriberRuntime"

export const NOTIFICATIONS_BOOKING_CONFIRMED_REMINDER_SUBSCRIBER_ID =
  "@voyant-travel/notifications#subscriber.reminder-booking-confirmed"
export const NOTIFICATIONS_PAYMENT_COMPLETED_REMINDER_SUBSCRIBER_ID =
  "@voyant-travel/notifications#subscriber.reminder-payment-completed"
export const NOTIFICATIONS_BOOKING_CANCELLED_REMINDER_SUBSCRIBER_ID =
  "@voyant-travel/notifications#subscriber.reminder-booking-cancelled"
export const NOTIFICATIONS_BOOKING_EXPIRED_REMINDER_SUBSCRIBER_ID =
  "@voyant-travel/notifications#subscriber.reminder-booking-expired"
export const NOTIFICATIONS_BOOKING_CONFIRMATION_AUTO_DISPATCH_SUBSCRIBER_ID =
  "@voyant-travel/notifications#subscriber.booking-confirmation-auto-dispatch"

export interface NotificationsAutoConfirmAndDispatchOptions {
  enabled?: boolean
  templateSlug?: string
  documentTypes?: Array<"contract" | "invoice" | "proforma">
}

/** Deployment-owned services required by package-owned Notifications subscribers. */
export interface NotificationsSubscriberRuntime {
  resolveDb(bindings: unknown): PostgresJsDatabase
  dispatcher: NotificationService
  documentAttachmentResolver?: BookingDocumentAttachmentResolver
  autoConfirmAndDispatch?: NotificationsAutoConfirmAndDispatchOptions
}

export interface NotificationsSubscriberDependencies {
  dispatchReminderRules?: typeof dispatchReminderEventRules
  isPaidInFull?: typeof bookingIsPaidInFullForNotification
  confirmAndDispatchBooking?: typeof bookingDocumentNotificationsService.confirmAndDispatchBooking
  logger?: Pick<Console, "error">
}

interface BookingConfirmedPayload extends Record<string, unknown> {
  bookingId: string
  bookingNumber: string
  actorId: string | null
  suppressNotifications?: boolean
}

interface BookingContractGeneratedPayload extends BookingConfirmedPayload {
  contractId: string
  attachmentId: string
}

interface PaymentCompletedPayload extends Record<string, unknown> {
  paymentSessionId: string
  bookingId?: string | null
  orderId?: string | null
  invoiceId?: string | null
  amountCents: number
  currency: string
  provider: string
}

interface BookingCancelledPayload extends Record<string, unknown> {
  bookingId: string
  bookingNumber: string
  previousStatus: "draft" | "on_hold" | "confirmed" | "in_progress"
  actorId: string | null
}

interface BookingExpiredPayload extends Record<string, unknown> {
  bookingId: string
  bookingNumber: string
  cause: "route" | "sweep"
  actorId: string | null
}

function resolveRuntime(container: ModuleContainer): NotificationsSubscriberRuntime {
  if (!container.has(NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY)) {
    throw new Error(
      `Notifications subscriber runtime is not registered at "${NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY}".`,
    )
  }
  return container.resolve<NotificationsSubscriberRuntime>(NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function createBookingConfirmedReminderSubscriberRuntime(
  dependencies: NotificationsSubscriberDependencies = {},
): SubscriberRuntimeDescriptor {
  const dispatchReminderRules = dependencies.dispatchReminderRules ?? dispatchReminderEventRules
  const logger = dependencies.logger ?? console

  return {
    id: NOTIFICATIONS_BOOKING_CONFIRMED_REMINDER_SUBSCRIBER_ID,
    eventType: "booking.confirmed",
    register: ({ bindings, container, eventBus }) => {
      eventBus.subscribe<BookingConfirmedPayload>("booking.confirmed", async ({ data }) => {
        try {
          const runtime = resolveRuntime(container)
          await dispatchReminderRules(
            runtime.resolveDb(bindings),
            runtime.dispatcher,
            { targetType: "booking_confirmed", bookingId: data.bookingId, eventData: data },
            { documentAttachmentResolver: runtime.documentAttachmentResolver },
          )
        } catch (error) {
          logger.error(
            `[notifications] booking_confirmed reminder rules failed for booking ${data.bookingId}: ${errorMessage(error)}`,
          )
        }
      })
    },
  }
}

export function createPaymentCompletedReminderSubscriberRuntime(
  dependencies: NotificationsSubscriberDependencies = {},
): SubscriberRuntimeDescriptor {
  const dispatchReminderRules = dependencies.dispatchReminderRules ?? dispatchReminderEventRules
  const isPaidInFull = dependencies.isPaidInFull ?? bookingIsPaidInFullForNotification
  const logger = dependencies.logger ?? console

  return {
    id: NOTIFICATIONS_PAYMENT_COMPLETED_REMINDER_SUBSCRIBER_ID,
    eventType: "payment.completed",
    register: ({ bindings, container, eventBus }) => {
      eventBus.subscribe<PaymentCompletedPayload>("payment.completed", async ({ data }) => {
        if (!data.bookingId) return

        try {
          const runtime = resolveRuntime(container)
          const db = runtime.resolveDb(bindings)
          if (!(await isPaidInFull(db, data.bookingId))) return

          await dispatchReminderRules(
            db,
            runtime.dispatcher,
            {
              targetType: "payment_complete",
              bookingId: data.bookingId,
              paymentSessionId: data.paymentSessionId,
              eventData: data,
            },
            { documentAttachmentResolver: runtime.documentAttachmentResolver },
          )
        } catch (error) {
          logger.error(
            `[notifications] payment_complete reminder rules failed for booking ${data.bookingId}: ${errorMessage(error)}`,
          )
        }
      })
    },
  }
}

export function createBookingCancelledReminderSubscriberRuntime(
  dependencies: NotificationsSubscriberDependencies = {},
): SubscriberRuntimeDescriptor {
  const dispatchReminderRules = dependencies.dispatchReminderRules ?? dispatchReminderEventRules
  const logger = dependencies.logger ?? console

  return {
    id: NOTIFICATIONS_BOOKING_CANCELLED_REMINDER_SUBSCRIBER_ID,
    eventType: "booking.cancelled",
    register: ({ bindings, container, eventBus }) => {
      eventBus.subscribe<BookingCancelledPayload>("booking.cancelled", async ({ data }) => {
        if (data.previousStatus !== "on_hold") return

        try {
          const runtime = resolveRuntime(container)
          await dispatchReminderRules(
            runtime.resolveDb(bindings),
            runtime.dispatcher,
            {
              targetType: "booking_cancelled_non_payment",
              bookingId: data.bookingId,
              eventData: data,
            },
            { documentAttachmentResolver: runtime.documentAttachmentResolver },
          )
        } catch (error) {
          logger.error(
            `[notifications] booking_cancelled_non_payment reminder rules failed for booking ${data.bookingId}: ${errorMessage(error)}`,
          )
        }
      })
    },
  }
}

export function createBookingExpiredReminderSubscriberRuntime(
  dependencies: NotificationsSubscriberDependencies = {},
): SubscriberRuntimeDescriptor {
  const dispatchReminderRules = dependencies.dispatchReminderRules ?? dispatchReminderEventRules
  const logger = dependencies.logger ?? console

  return {
    id: NOTIFICATIONS_BOOKING_EXPIRED_REMINDER_SUBSCRIBER_ID,
    eventType: "booking.expired",
    register: ({ bindings, container, eventBus }) => {
      eventBus.subscribe<BookingExpiredPayload>("booking.expired", async ({ data }) => {
        try {
          const runtime = resolveRuntime(container)
          await dispatchReminderRules(
            runtime.resolveDb(bindings),
            runtime.dispatcher,
            {
              targetType: "booking_cancelled_non_payment",
              bookingId: data.bookingId,
              eventData: data,
            },
            { documentAttachmentResolver: runtime.documentAttachmentResolver },
          )
        } catch (error) {
          logger.error(
            `[notifications] booking_cancelled_non_payment reminder rules failed for expired booking ${data.bookingId}: ${errorMessage(error)}`,
          )
        }
      })
    },
  }
}

export function createBookingConfirmationAutoDispatchSubscriberRuntime(
  dependencies: NotificationsSubscriberDependencies = {},
): SubscriberRuntimeDescriptor {
  const confirmAndDispatchBooking =
    dependencies.confirmAndDispatchBooking ??
    bookingDocumentNotificationsService.confirmAndDispatchBooking
  const logger = dependencies.logger ?? console

  return {
    id: NOTIFICATIONS_BOOKING_CONFIRMATION_AUTO_DISPATCH_SUBSCRIBER_ID,
    eventType: "booking.contract.generated",
    register: ({ bindings, container, eventBus }) => {
      eventBus.subscribe<BookingContractGeneratedPayload>(
        "booking.contract.generated",
        async ({ data }) => {
          if (data.suppressNotifications === true) return

          try {
            const runtime = resolveRuntime(container)
            const options = runtime.autoConfirmAndDispatch
            if (!options?.enabled) return

            await confirmAndDispatchBooking(
              runtime.resolveDb(bindings),
              runtime.dispatcher,
              data.bookingId,
              {
                templateSlug: options.templateSlug ?? null,
                documentTypes: options.documentTypes ?? null,
              },
              { attachmentResolver: runtime.documentAttachmentResolver, eventBus },
            )
          } catch (error) {
            logger.error(
              `[notifications] auto-dispatch failed for booking ${data.bookingId}: ${errorMessage(error)}`,
            )
          }
        },
      )
    },
  }
}

export const notificationsBookingConfirmedReminderSubscriber =
  createBookingConfirmedReminderSubscriberRuntime()
export const notificationsPaymentCompletedReminderSubscriber =
  createPaymentCompletedReminderSubscriberRuntime()
export const notificationsBookingCancelledReminderSubscriber =
  createBookingCancelledReminderSubscriberRuntime()
export const notificationsBookingExpiredReminderSubscriber =
  createBookingExpiredReminderSubscriberRuntime()
export const notificationsBookingConfirmationAutoDispatchSubscriber =
  createBookingConfirmationAutoDispatchSubscriberRuntime()

export const notificationsReminderSubscriberRuntimeDescriptors = [
  notificationsBookingConfirmedReminderSubscriber,
  notificationsPaymentCompletedReminderSubscriber,
  notificationsBookingCancelledReminderSubscriber,
  notificationsBookingExpiredReminderSubscriber,
] as const
