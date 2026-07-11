import { defineExtension, defineModule } from "@voyant-travel/core/project"

const schemaSource = "@voyant-travel/notifications/schema"

/** Import-cheap deployment declaration owned by the notifications package. */
export const notificationsVoyantModule = defineModule({
  id: "@voyant-travel/notifications",
  packageName: "@voyant-travel/notifications",
  localId: "notifications",
  provides: { capabilities: ["notifications.delivery"] },
  api: [
    {
      id: "@voyant-travel/notifications#api.admin",
      surface: "admin",
      mount: "notifications",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/notifications",
        export: "createNotificationsHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/notifications#schema",
      source: schemaSource,
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/notifications#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/notifications#linkable.notification-template",
      source: schemaSource,
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-delivery",
      source: schemaSource,
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-reminder-rule",
      source: schemaSource,
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-reminder-run",
      source: schemaSource,
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-reminder-rule-stage",
      source: schemaSource,
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-reminder-stage-channel",
      source: schemaSource,
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-settings",
      source: schemaSource,
    },
  ],
  workflows: [
    {
      id: "notifications.deliver-reminder",
      config: {
        defaultRuntime: "node",
        retry: {
          max: 3,
          backoff: "exponential",
          maxDelay: "300s",
        },
      },
      source: "@voyant-travel/notifications/workflows",
      runtime: {
        entry: "@voyant-travel/notifications/workflows",
        export: "notificationsDeliverReminderWorkflow",
      },
    },
    {
      id: "notifications.send-due-reminders",
      config: {
        defaultRuntime: "node",
        schedule: {
          cron: "0 * * * *",
          name: "hourly",
        },
      },
      source: "@voyant-travel/notifications/workflows",
      runtime: {
        entry: "@voyant-travel/notifications/workflows",
        export: "notificationsSendDueRemindersWorkflow",
      },
    },
  ],
  events: [
    {
      id: "@voyant-travel/notifications#event.booking.fully-paid",
      eventType: "booking.fully-paid",
    },
    {
      id: "@voyant-travel/notifications#event.booking.documents.sent",
      eventType: "booking.documents.sent",
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/notifications#access.notifications",
        resource: "notifications",
        actions: ["read", "send"],
      },
    ],
  },
  tools: [
    {
      id: "@voyant-travel/notifications#tool.list-deliveries",
      name: "list_notification_deliveries",
      runtime: {
        entry: "@voyant-travel/notifications/tools",
        export: "listDeliveriesTool",
      },
      requiredScopes: ["notifications:read"],
    },
    {
      id: "@voyant-travel/notifications#tool.get-delivery",
      name: "get_notification_delivery",
      runtime: { entry: "@voyant-travel/notifications/tools", export: "getDeliveryTool" },
      requiredScopes: ["notifications:read"],
    },
    {
      id: "@voyant-travel/notifications#tool.send-notification",
      name: "send_notification",
      runtime: {
        entry: "@voyant-travel/notifications/tools",
        export: "sendNotificationTool",
      },
      requiredScopes: ["notifications:send"],
    },
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

/**
 * Inert until a deployment explicitly selects the extension and removes the
 * legacy module-bootstrap registrations. Confirmation auto-dispatch is omitted
 * until Legal document ordering has an explicit runtime contract.
 */
export const notificationsReminderSubscribersVoyantPlugin = defineExtension({
  id: "@voyant-travel/notifications#reminder-subscribers-extension",
  packageName: "@voyant-travel/notifications",
  localId: "notifications.reminder-subscribers-extension",
  subscribers: [
    {
      id: "@voyant-travel/notifications#subscriber.reminder-booking-confirmed",
      eventType: "booking.confirmed",
      source: "@voyant-travel/notifications/subscriber-runtime",
      runtime: {
        entry: "./subscriber-runtime",
        export: "notificationsBookingConfirmedReminderSubscriber",
      },
    },
    {
      id: "@voyant-travel/notifications#subscriber.reminder-payment-completed",
      eventType: "payment.completed",
      source: "@voyant-travel/notifications/subscriber-runtime",
      runtime: {
        entry: "./subscriber-runtime",
        export: "notificationsPaymentCompletedReminderSubscriber",
      },
    },
    {
      id: "@voyant-travel/notifications#subscriber.reminder-booking-cancelled",
      eventType: "booking.cancelled",
      source: "@voyant-travel/notifications/subscriber-runtime",
      runtime: {
        entry: "./subscriber-runtime",
        export: "notificationsBookingCancelledReminderSubscriber",
      },
    },
    {
      id: "@voyant-travel/notifications#subscriber.reminder-booking-expired",
      eventType: "booking.expired",
      source: "@voyant-travel/notifications/subscriber-runtime",
      runtime: {
        entry: "./subscriber-runtime",
        export: "notificationsBookingExpiredReminderSubscriber",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default notificationsVoyantModule
