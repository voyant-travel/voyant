// agent-quality: file-size exception -- owner: notifications; existing module stays co-located until a dedicated split preserves behavior and tests.
import type { Module } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { HonoModule } from "@voyant-travel/hono/module"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  buildNotificationsRouteRuntime,
  createNotificationsRoutes,
  NOTIFICATIONS_ROUTE_RUNTIME_CONTAINER_KEY,
  type NotificationsRoutesOptions,
} from "./routes.js"
import { notificationsModule } from "./schema.js"
import { createNotificationService } from "./service.js"
import {
  BOOKING_FULLY_PAID_EVENT,
  type BookingDocumentBundleLifecycleOptions,
  type BookingFullyPaidEvent,
  bookingDocumentBundleLifecycleService,
  type RunBookingDocumentBundleLifecycleInput,
} from "./service-booking-document-lifecycle.js"
import { bookingDocumentNotificationsService } from "./service-booking-documents.js"
import {
  bookingIsPaidInFullForNotification,
  dispatchReminderEventRules,
} from "./service-reminders.js"

export {
  notificationLiquidEngine,
  renderLiquidTemplate,
} from "./liquid.js"
export type { LocalProviderOptions } from "./providers/local.js"
export { createLocalProvider } from "./providers/local.js"
export type {
  VoyantCloudEmailProviderOptions,
  VoyantCloudEmailRendered,
} from "./providers/voyant-cloud-email.js"
export { createVoyantCloudEmailProvider } from "./providers/voyant-cloud-email.js"
export type {
  VoyantCloudSmsProviderOptions,
  VoyantCloudSmsRendered,
} from "./providers/voyant-cloud-sms.js"
export { createVoyantCloudSmsProvider } from "./providers/voyant-cloud-sms.js"
export type { NotificationsRouteRuntime, NotificationsRoutesOptions } from "./routes.js"
export {
  buildNotificationsRouteRuntime,
  createNotificationsRoutes,
  NOTIFICATIONS_ROUTE_RUNTIME_CONTAINER_KEY,
} from "./routes.js"
export type {
  NewNotificationDelivery,
  NewNotificationReminderRule,
  NewNotificationReminderRun,
  NewNotificationTemplate,
  NotificationDelivery,
  NotificationReminderRule,
  NotificationReminderRun,
  NotificationsHonoModule,
  NotificationTemplate,
} from "./schema.js"
export {
  notificationChannelEnum,
  notificationDeliveries,
  notificationDeliveryStatusEnum,
  notificationReminderRules,
  notificationReminderRunStatusEnum,
  notificationReminderRuns,
  notificationReminderStatusEnum,
  notificationReminderTargetTypeEnum,
  notificationsModule,
  notificationTargetTypeEnum,
  notificationTemplateStatusEnum,
  notificationTemplates,
} from "./schema.js"
export type { NotificationService } from "./service.js"
export {
  createDefaultBookingDocumentAttachment,
  createNotificationService,
  NotificationError,
  notificationsService,
  previewNotificationTemplate,
  renderNotificationTemplate,
} from "./service.js"
export type {
  BookingDocumentBundleLifecycleContext,
  BookingDocumentBundleLifecycleDocumentType,
  BookingDocumentBundleLifecycleEnsureDocuments,
  BookingDocumentBundleLifecycleEvent,
  BookingDocumentBundleLifecycleOptions,
  BookingDocumentBundleLifecyclePolicy,
  BookingDocumentBundleLifecyclePolicyResult,
  BookingDocumentBundleLifecycleResolveBrochures,
  BookingDocumentBundleLifecycleResult,
  BookingDocumentBundleLifecycleStageOptions,
  BookingDocumentBundleLifecycleStep,
  BookingDocumentBundleLifecycleTrigger,
  BookingDocumentBundleNotificationPolicy,
  BookingFullyPaidEvent,
} from "./service-booking-document-lifecycle.js"
export {
  BOOKING_FULLY_PAID_EVENT,
  bookingDocumentBundleLifecycleService,
  createDefaultBookingDocumentBundlePolicy,
  resolveBookingDocumentBundleLifecycleContext,
} from "./service-booking-document-lifecycle.js"
export type {
  BookingDocumentAttachmentResolver,
  BookingDocumentsSentEvent,
  SendBookingDocumentsRuntimeOptions,
} from "./service-booking-documents.js"
export { bookingDocumentNotificationsService } from "./service-booking-documents.js"
export {
  bookingIsPaidInFullForNotification,
  dispatchReminderEventRules,
} from "./service-reminders.js"
export type {
  NotificationTaskEnv,
  NotificationTaskRuntime,
  NotificationTaskRuntimeOptions,
  ReminderDeliveryJob,
} from "./task-runtime.js"
export { buildNotificationTaskRuntime } from "./task-runtime.js"
export { deliverQueuedNotificationReminder, sendDueNotificationReminders } from "./tasks/index.js"
export type {
  NotificationLiquidSnippet,
  NotificationTemplateVariableCategory,
  NotificationTemplateVariableDefinition,
  NotificationTemplateVariableType,
} from "./template-authoring.js"
export {
  notificationLiquidSnippets,
  notificationTemplateVariableCatalog,
} from "./template-authoring.js"
export type {
  NotificationAttachment,
  NotificationChannel,
  NotificationPayload,
  NotificationProvider,
  NotificationResult,
} from "./types.js"
export {
  bookingDocumentBundleItemSchema,
  bookingDocumentBundleSchema,
  insertNotificationReminderRuleSchema,
  insertNotificationReminderRuleStageSchema,
  insertNotificationReminderStageChannelSchema,
  insertNotificationTemplateSchema,
  notificationAttachmentSchema,
  notificationChannelSchema,
  notificationDeliveryListQuerySchema,
  notificationDeliveryStatusSchema,
  notificationDocumentSourceSchema,
  notificationDocumentTypeSchema,
  notificationReminderRuleListQuerySchema,
  notificationReminderRunDeliverySummarySchema,
  notificationReminderRunLinksSchema,
  notificationReminderRunListQuerySchema,
  notificationReminderRunListResponseSchema,
  notificationReminderRunRecordSchema,
  notificationReminderRunRuleSummarySchema,
  notificationReminderRunStatusSchema,
  notificationReminderStageAnchorSchema,
  notificationReminderStageCadenceIntervalSchema,
  notificationReminderStageCadenceKindSchema,
  notificationReminderStatusSchema,
  notificationReminderTargetTypeSchema,
  notificationStageRecipientKindSchema,
  notificationTargetTypeSchema,
  notificationTemplateListQuerySchema,
  notificationTemplateStatusSchema,
  previewNotificationTemplateResultSchema,
  previewNotificationTemplateSchema,
  previewRemindersQuerySchema,
  reorderReminderRuleStagesSchema,
  runDueRemindersSchema,
  sendBookingDocumentsNotificationResultSchema,
  sendBookingDocumentsNotificationSchema,
  sendInvoiceNotificationSchema,
  sendNotificationSchema,
  sendPaymentSessionNotificationSchema,
  updateNotificationReminderRuleSchema,
  updateNotificationReminderRuleStageSchema,
  updateNotificationReminderStageChannelSchema,
  updateNotificationSettingsSchema,
  updateNotificationTemplateSchema,
} from "./validation.js"
export {
  type DeliverReminderWorkflowInput,
  type DeliverReminderWorkflowOutput,
  NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY,
  type NotificationReminderWorkflowRuntime,
  type SendDueRemindersWorkflowInput,
} from "./workflow-runtime.js"

/**
 * Auto-dispatch policy for the `booking.confirmed` subscriber. Set `enabled:
 * false` (or leave the option off entirely) to opt out.
 */
export interface NotificationsAutoConfirmAndDispatchOptions {
  enabled?: boolean
  /** Notification template slug used when the handler fires. */
  templateSlug?: string
  /** Optional allowlist of document types to attach; defaults to all. */
  documentTypes?: Array<"contract" | "invoice" | "proforma">
}

export interface CreateNotificationsHonoModuleOptions extends NotificationsRoutesOptions {
  /**
   * Resolves a database from runtime bindings. Required for
   * `autoConfirmAndDispatch` — the `booking.confirmed` subscriber fires
   * outside a request scope and needs its own db handle. Returns
   * `AnyDrizzleDb` (the union of `PostgresJsDatabase | NeonHttpDatabase`)
   * so consumers don't have to cast through `unknown` when wiring a
   * Hyperdrive/Neon client.
   */
  resolveDb?: (bindings: Record<string, unknown>) => AnyDrizzleDb
  autoConfirmAndDispatch?: NotificationsAutoConfirmAndDispatchOptions
  /**
   * First-class booking lifecycle hook for composing customer document
   * bundles after confirmation and fully-paid transitions. Host apps can
   * plug legal/finance/brochure generators and override notification policy
   * without replacing the upstream event wiring.
   */
  documentBundleLifecycle?: BookingDocumentBundleLifecycleOptions
}

function logDocumentBundleLifecycleFailure(
  input: RunBookingDocumentBundleLifecycleInput,
  message: string,
) {
  console.error(
    `[notifications] document-bundle lifecycle failed for ${input.trigger} booking ${input.event.bookingId}: ${message}`,
  )
}

export function createNotificationsHonoModule(
  options?: CreateNotificationsHonoModuleOptions,
): HonoModule {
  const routes = createNotificationsRoutes(options)

  const module: Module = {
    ...notificationsModule,
    bootstrap: ({ bindings, container, eventBus }) => {
      container.register(
        NOTIFICATIONS_ROUTE_RUNTIME_CONTAINER_KEY,
        buildNotificationsRouteRuntime(bindings as Record<string, unknown>, options),
      )

      // Auto-dispatch wiring — opt-in. When enabled, every `booking.confirmed`
      // event triggers a `confirmAndDispatchBooking` call so the operator
      // doesn't have to click a second button. The handler runs in the same
      // process as the emitter (the in-process event bus) but outside the
      // request scope, so we resolve our own db handle from bindings.
      if (options?.autoConfirmAndDispatch?.enabled && options.resolveDb) {
        const resolveDb = options.resolveDb
        const autoOptions = options.autoConfirmAndDispatch
        const runtime = buildNotificationsRouteRuntime(bindings as Record<string, unknown>, options)
        const dispatcher = createNotificationService(runtime.providers)

        eventBus.subscribe(
          "booking.confirmed",
          async (event: {
            data: {
              bookingId: string
              bookingNumber: string
              actorId: string | null
              suppressNotifications?: boolean
            }
          }) => {
            // Honor caller opt-out — the operator may want to confirm
            // a booking without firing the customer-facing email/doc
            // bundle (e.g. data correction, manual hand-off).
            if (event.data.suppressNotifications === true) return
            try {
              // The resolver may return either drizzle flavor; the queries
              // bookingDocumentNotificationsService runs are compatible with
              // both at runtime, so we narrow at this internal boundary.
              const db = resolveDb(bindings as Record<string, unknown>) as PostgresJsDatabase
              await bookingDocumentNotificationsService.confirmAndDispatchBooking(
                db,
                dispatcher,
                event.data.bookingId,
                {
                  templateSlug: autoOptions.templateSlug ?? null,
                  documentTypes: autoOptions.documentTypes ?? null,
                },
                {
                  attachmentResolver: runtime.documentAttachmentResolver,
                  eventBus,
                },
              )
            } catch (error) {
              // Per the EventBus contract, handler failures are logged, not
              // rethrown. We surface the context so ops can diagnose without
              // digging through stack traces.
              const message = error instanceof Error ? error.message : String(error)
              console.error(
                `[notifications] auto-dispatch failed for booking ${event.data.bookingId}: ${message}`,
              )
            }
          },
        )
      }

      if (options?.documentBundleLifecycle?.enabled && options.resolveDb) {
        const resolveDb = options.resolveDb
        const lifecycleOptions = options.documentBundleLifecycle
        const runtime = buildNotificationsRouteRuntime(bindings as Record<string, unknown>, options)
        const dispatcher = createNotificationService(runtime.providers)

        const runLifecycle = async (input: RunBookingDocumentBundleLifecycleInput) => {
          try {
            const db = resolveDb(bindings as Record<string, unknown>) as PostgresJsDatabase
            const result = await bookingDocumentBundleLifecycleService.run(
              db,
              dispatcher,
              input,
              lifecycleOptions,
              { attachmentResolver: runtime.documentAttachmentResolver, eventBus },
            )
            if (result.status === "failed") {
              logDocumentBundleLifecycleFailure(input, result.error)
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            logDocumentBundleLifecycleFailure(input, message)
          }
        }

        eventBus.subscribe(
          "booking.confirmed",
          async (event: {
            data: { bookingId: string; bookingNumber: string; actorId: string | null }
          }) => {
            await runLifecycle({ trigger: "booking.confirmed", event: event.data })
          },
        )

        eventBus.subscribe(
          BOOKING_FULLY_PAID_EVENT,
          async (event: { data: BookingFullyPaidEvent }) => {
            await runLifecycle({ trigger: BOOKING_FULLY_PAID_EVENT, event: event.data })
          },
        )

        eventBus.subscribe(
          "payment.completed",
          async (event: {
            data: {
              paymentSessionId: string
              bookingId?: string | null
              orderId?: string | null
              invoiceId?: string | null
              amountCents: number
              currency: string
              provider: string
            }
          }) => {
            if (!event.data.bookingId) {
              return
            }

            try {
              const db = resolveDb(bindings as Record<string, unknown>) as PostgresJsDatabase
              const isPaidInFull = await bookingIsPaidInFullForNotification(
                db,
                event.data.bookingId,
              )
              if (!isPaidInFull) {
                return
              }

              await eventBus.emit(
                BOOKING_FULLY_PAID_EVENT,
                {
                  bookingId: event.data.bookingId,
                  paymentSessionId: event.data.paymentSessionId,
                  invoiceId: event.data.invoiceId ?? null,
                  amountCents: event.data.amountCents,
                  currency: event.data.currency,
                  provider: event.data.provider,
                } satisfies BookingFullyPaidEvent,
                { category: "domain", source: "subscriber" },
              )
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              console.error(
                `[notifications] booking.fully-paid dispatch failed for booking ${event.data.bookingId}: ${message}`,
              )
            }
          },
        )
      }

      if (options?.resolveDb) {
        const resolveDb = options.resolveDb
        const runtime = buildNotificationsRouteRuntime(bindings as Record<string, unknown>, options)
        const dispatcher = createNotificationService(runtime.providers)

        eventBus.subscribe(
          "booking.confirmed",
          async (event: {
            data: { bookingId: string; bookingNumber: string; actorId: string | null }
          }) => {
            try {
              const db = resolveDb(bindings as Record<string, unknown>) as PostgresJsDatabase
              await dispatchReminderEventRules(
                db,
                dispatcher,
                {
                  targetType: "booking_confirmed",
                  bookingId: event.data.bookingId,
                  eventData: event.data,
                },
                { documentAttachmentResolver: runtime.documentAttachmentResolver },
              )
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              console.error(
                `[notifications] booking_confirmed reminder rules failed for booking ${event.data.bookingId}: ${message}`,
              )
            }
          },
        )

        eventBus.subscribe(
          "payment.completed",
          async (event: {
            data: {
              paymentSessionId: string
              bookingId?: string | null
              orderId?: string | null
              invoiceId?: string | null
              amountCents: number
              currency: string
              provider: string
            }
          }) => {
            if (!event.data.bookingId) {
              return
            }

            try {
              const db = resolveDb(bindings as Record<string, unknown>) as PostgresJsDatabase
              const isPaidInFull = await bookingIsPaidInFullForNotification(
                db,
                event.data.bookingId,
              )
              if (!isPaidInFull) {
                return
              }

              await dispatchReminderEventRules(
                db,
                dispatcher,
                {
                  targetType: "payment_complete",
                  bookingId: event.data.bookingId,
                  paymentSessionId: event.data.paymentSessionId,
                  eventData: event.data,
                },
                { documentAttachmentResolver: runtime.documentAttachmentResolver },
              )
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              console.error(
                `[notifications] payment_complete reminder rules failed for booking ${event.data.bookingId}: ${message}`,
              )
            }
          },
        )

        eventBus.subscribe(
          "booking.cancelled",
          async (event: {
            data: {
              bookingId: string
              bookingNumber: string
              previousStatus: "draft" | "on_hold" | "confirmed" | "in_progress"
              actorId: string | null
            }
          }) => {
            if (event.data.previousStatus !== "on_hold") {
              return
            }

            try {
              const db = resolveDb(bindings as Record<string, unknown>) as PostgresJsDatabase
              await dispatchReminderEventRules(
                db,
                dispatcher,
                {
                  targetType: "booking_cancelled_non_payment",
                  bookingId: event.data.bookingId,
                  eventData: event.data,
                },
                { documentAttachmentResolver: runtime.documentAttachmentResolver },
              )
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              console.error(
                `[notifications] booking_cancelled_non_payment reminder rules failed for booking ${event.data.bookingId}: ${message}`,
              )
            }
          },
        )

        eventBus.subscribe(
          "booking.expired",
          async (event: {
            data: {
              bookingId: string
              bookingNumber: string
              cause: "route" | "sweep"
              actorId: string | null
            }
          }) => {
            try {
              const db = resolveDb(bindings as Record<string, unknown>) as PostgresJsDatabase
              await dispatchReminderEventRules(
                db,
                dispatcher,
                {
                  targetType: "booking_cancelled_non_payment",
                  bookingId: event.data.bookingId,
                  eventData: event.data,
                },
                { documentAttachmentResolver: runtime.documentAttachmentResolver },
              )
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              console.error(
                `[notifications] booking_cancelled_non_payment reminder rules failed for expired booking ${event.data.bookingId}: ${message}`,
              )
            }
          },
        )
      }
    },
  }

  return {
    module,
    adminRoutes: routes,
  }
}
