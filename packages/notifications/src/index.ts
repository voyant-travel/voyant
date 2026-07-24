// agent-quality: file-size exception -- owner: notifications; existing module stays co-located until a dedicated split preserves behavior and tests.
import type { BootstrapContext, Module } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { ApiModule } from "@voyant-travel/hono/module"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  buildNotificationsRouteRuntime,
  createNotificationsRoutes,
  NOTIFICATIONS_ROUTE_RUNTIME_CONTAINER_KEY,
  type NotificationsRoutesOptions,
} from "./routes.js"
import { notificationsRuntimePort } from "./runtime-port.js"
import { notificationsModule } from "./schema.js"
import { createNotificationService } from "./service.js"
import type { BookingDocumentBundleLifecycleOptions } from "./service-booking-document-lifecycle.js"
import {
  NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY,
  type NotificationsAutoConfirmAndDispatchOptions,
  type NotificationsSubscriberRuntime,
} from "./subscriber-runtime.js"

export {
  type DeliverReminderJobInput,
  type DeliverReminderJobOutput,
  NOTIFICATION_REMINDER_JOB_RUNTIME_KEY,
  type NotificationReminderJobRuntime,
  type SendDueRemindersJobInput,
} from "./job-runtime.js"
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
export type { NotificationsRuntimeProvider } from "./runtime-port.js"
export { notificationsRuntimePort } from "./runtime-port.js"
export type {
  NewNotificationDelivery,
  NewNotificationReminderRule,
  NewNotificationReminderRun,
  NewNotificationSendOperation,
  NewNotificationTemplate,
  NotificationDelivery,
  NotificationReminderRule,
  NotificationReminderRun,
  NotificationSendOperation,
  NotificationsApiModule,
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
  notificationSendOperationStatusEnum,
  notificationSendOperations,
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
  NotificationIdempotencyConflictError,
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
/**
 * Auto-dispatch policy for the `booking.confirmed` subscriber. Set `enabled:
 * false` (or leave the option off entirely) to opt out.
 */
export type {
  NotificationsAutoConfirmAndDispatchOptions,
  NotificationsSubscriberDependencies,
  NotificationsSubscriberRuntime,
} from "./subscriber-runtime.js"
export {
  createBookingCancelledReminderSubscriberRuntime,
  createBookingConfirmationAutoDispatchSubscriberRuntime,
  createBookingConfirmedReminderSubscriberRuntime,
  createBookingExpiredReminderSubscriberRuntime,
  createBookingFullyPaidDocumentLifecycleSubscriberRuntime,
  createPaymentCompletedReminderSubscriberRuntime,
  NOTIFICATIONS_BOOKING_CANCELLED_REMINDER_SUBSCRIBER_ID,
  NOTIFICATIONS_BOOKING_CONFIRMATION_AUTO_DISPATCH_SUBSCRIBER_ID,
  NOTIFICATIONS_BOOKING_CONFIRMED_REMINDER_SUBSCRIBER_ID,
  NOTIFICATIONS_BOOKING_EXPIRED_REMINDER_SUBSCRIBER_ID,
  NOTIFICATIONS_BOOKING_FULLY_PAID_DOCUMENT_LIFECYCLE_SUBSCRIBER_ID,
  NOTIFICATIONS_PAYMENT_COMPLETED_REMINDER_SUBSCRIBER_ID,
  NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY,
  notificationsBookingCancelledReminderSubscriber,
  notificationsBookingConfirmationAutoDispatchSubscriber,
  notificationsBookingConfirmedReminderSubscriber,
  notificationsBookingExpiredReminderSubscriber,
  notificationsBookingFullyPaidDocumentLifecycleSubscriber,
  notificationsPaymentCompletedReminderSubscriber,
  notificationsReminderSubscriberRuntimeDescriptors,
} from "./subscriber-runtime.js"
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
  DurableNotificationDeliveryCapability,
  DurableNotificationDeliveryContext,
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

export interface CreateNotificationsApiModuleOptions extends NotificationsRoutesOptions {
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

export function createNotificationsApiModule(
  options?: CreateNotificationsApiModuleOptions,
): ApiModule {
  const routes = createNotificationsRoutes(options)

  const module: Module = {
    ...notificationsModule,
    bootstrap: ({ bindings, container }) => {
      container.register(
        NOTIFICATIONS_ROUTE_RUNTIME_CONTAINER_KEY,
        buildNotificationsRouteRuntime(bindings as Record<string, unknown>, options),
      )
    },
  }

  return {
    module,
    adminRoutes: routes,
  }
}

/** Package-owned adapter from the selected graph's typed Node host port. */
export const createNotificationsVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) => {
  const provider = await getPort(notificationsRuntimePort)
  const configured = createNotificationsApiModule(provider)
  const bootstrap = configured.module.bootstrap

  return {
    ...configured,
    module: {
      ...configured.module,
      bootstrap: async (context: BootstrapContext) => {
        await bootstrap?.(context)
      },
    },
  }
})

/** Selected-extension adapter that gates subscriber services with subscriber selection. */
export const createNotificationsSubscribersVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) => {
    const provider = await getPort(notificationsRuntimePort)
    return {
      extension: {
        name: "notifications-reminder-subscribers",
        module: "notifications",
        bootstrap: ({ bindings, container }: BootstrapContext) => {
          container.register(
            NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY,
            createNotificationsSubscriberRuntime(bindings as Record<string, unknown>, provider),
          )
        },
      },
    }
  },
)

function createNotificationsSubscriberRuntime(
  bindings: Record<string, unknown>,
  provider: import("./runtime-port.js").NotificationsRuntimeProvider,
): NotificationsSubscriberRuntime {
  const runtime = buildNotificationsRouteRuntime(bindings, provider)
  return {
    resolveDb: (runtimeBindings) =>
      provider.resolveDb(runtimeBindings as Record<string, unknown>) as PostgresJsDatabase,
    dispatcher: createNotificationService(runtime.providers),
    documentAttachmentResolver: runtime.documentAttachmentResolver,
    autoConfirmAndDispatch: provider.autoConfirmAndDispatch,
    documentBundleLifecycle: provider.documentBundleLifecycle,
  }
}
