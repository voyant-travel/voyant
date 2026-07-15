import {
  defineExtension,
  defineModule,
  providePort,
  requirePort,
} from "@voyant-travel/core/project"
import { financeNotificationsRuntimePort } from "@voyant-travel/finance/runtime-port"
import { storefrontVerificationRuntimePort } from "@voyant-travel/storefront/runtime-port"
import { quotesNotificationsRuntimePort } from "@voyant-travel/quotes/runtime-port"
import {
  bookingDocumentsSentEventPayloadSchema,
  bookingFullyPaidEventPayloadSchema,
} from "./event-payload-schemas.js"
import { notificationsRuntimePort } from "./runtime-port.js"

const schemaSource = "@voyant-travel/notifications/schema"

/** Import-cheap deployment declaration owned by the notifications package. */
export const notificationsVoyantModule = defineModule({
  id: "@voyant-travel/notifications",
  packageName: "@voyant-travel/notifications",
  localId: "notifications",
  runtimePorts: [requirePort(notificationsRuntimePort)],
  provides: {
    capabilities: ["notifications.delivery"],
    ports: [
      providePort(storefrontVerificationRuntimePort),
      providePort(financeNotificationsRuntimePort),
      providePort(notificationsRuntimePort),
      providePort(quotesNotificationsRuntimePort),
    ],
  },
  api: [
    {
      id: "@voyant-travel/notifications#api.admin",
      surface: "admin",
      mount: "notifications",
      openapi: { document: "notifications" },
      transactional: true,
      runtime: {
        entry: "@voyant-travel/notifications",
        export: "createNotificationsVoyantRuntime",
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
      kind: "linkable",
      source: schemaSource,
      export: "notificationTemplateLinkable",
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-delivery",
      kind: "linkable",
      source: schemaSource,
      export: "notificationDeliveryLinkable",
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-reminder-rule",
      kind: "linkable",
      source: schemaSource,
      export: "notificationReminderRuleLinkable",
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-reminder-run",
      kind: "linkable",
      source: schemaSource,
      export: "notificationReminderRunLinkable",
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-reminder-rule-stage",
      kind: "linkable",
      source: schemaSource,
      export: "notificationReminderRuleStageLinkable",
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-reminder-stage-channel",
      kind: "linkable",
      source: schemaSource,
      export: "notificationReminderStageChannelLinkable",
    },
    {
      id: "@voyant-travel/notifications#linkable.notification-settings",
      kind: "linkable",
      source: schemaSource,
      export: "notificationSettingsLinkable",
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
      version: "1.0.0",
      payloadSchema: bookingFullyPaidEventPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "notifications", category: "domain" },
    },
    {
      id: "@voyant-travel/notifications#event.booking.documents.sent",
      eventType: "booking.documents.sent",
      version: "1.0.0",
      payloadSchema: bookingDocumentsSentEventPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "notifications", category: "domain" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/notifications#access.notifications",
        resource: "notifications",
        label: "Notifications",
        description: "View notification delivery history and send vetted templates.",
        actions: [
          {
            action: "read",
            label: "View notifications",
            description: "View notification templates, reminders, and delivery history.",
          },
          {
            action: "send",
            label: "Send notifications",
            description: "Send a vetted notification template to a recipient.",
            sensitive: true,
            wildcard: "explicit",
          },
        ],
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
      context: ["notifications"],
      risk: "low",
    },
    {
      id: "@voyant-travel/notifications#tool.get-delivery",
      name: "get_notification_delivery",
      runtime: { entry: "@voyant-travel/notifications/tools", export: "getDeliveryTool" },
      requiredScopes: ["notifications:read"],
      context: ["notifications"],
      risk: "low",
    },
    {
      id: "@voyant-travel/notifications#tool.send-notification",
      name: "send_notification",
      runtime: {
        entry: "@voyant-travel/notifications/tools",
        export: "sendNotificationTool",
      },
      requiredScopes: ["notifications:send"],
      context: ["notifications"],
      risk: "high",
    },
  ],
  actions: [
    {
      id: "@voyant-travel/notifications#action.send-notification",
      version: "v1",
      kind: "execute",
      targetType: "notification",
      resource: "notifications",
      action: "send",
      requiredScopes: ["notifications:send"],
      risk: "high",
      ledger: "required",
      approval: "required",
      reversible: false,
      from: { tools: ["@voyant-travel/notifications#tool.send-notification"] },
    },
  ],
  admin: {
    compositionOrder: 70,
    runtime: {
      entry: "@voyant-travel/notifications-react/admin",
      export: "createSelectedNotificationsAdminExtension",
    },
    copy: [
      {
        id: "@voyant-travel/notifications#admin.copy",
        namespace: "notifications.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/notifications-react/i18n",
          export: "notificationsUiMessageDefinitions",
        },
      },
    ],
    routes: (
      [
        ["index", "/notifications"],
        ["templates-index", "/notifications/templates"],
        ["templates-detail", "/notifications/templates/$id"],
        ["reminder-rules-index", "/notifications/reminder-rules"],
        ["reminder-rules-detail", "/notifications/reminder-rules/$id"],
        ["deliveries", "/notifications/deliveries"],
        ["reminder-runs", "/notifications/reminder-runs"],
        ["preview", "/notifications/preview"],
        ["settings", "/notifications/settings"],
      ] as const
    ).map(([id, path]) => ({
      id: `@voyant-travel/notifications#admin.route.${id}`,
      path,
      requiredScopes: ["notifications:read"],
      runtime: {
        entry: "@voyant-travel/notifications-react/admin",
        export: "createNotificationsAdminExtension",
      },
    })),
    nav: [
      {
        id: "@voyant-travel/notifications#admin.nav.templates",
        routeId: "@voyant-travel/notifications#admin.route.templates-index",
        label: { namespace: "notifications.admin", key: "admin.templatesPage.title" },
      },
      {
        id: "@voyant-travel/notifications#admin.nav.reminder-rules",
        routeId: "@voyant-travel/notifications#admin.route.reminder-rules-index",
        label: { namespace: "notifications.admin", key: "admin.reminderRulesPage.title" },
      },
      {
        id: "@voyant-travel/notifications#admin.nav.deliveries",
        routeId: "@voyant-travel/notifications#admin.route.deliveries",
        label: { namespace: "notifications.admin", key: "admin.deliveriesPage.title" },
      },
      {
        id: "@voyant-travel/notifications#admin.nav.reminder-runs",
        routeId: "@voyant-travel/notifications#admin.route.reminder-runs",
        label: { namespace: "notifications.admin", key: "admin.reminderRunsPage.title" },
      },
      {
        id: "@voyant-travel/notifications#admin.nav.preview",
        routeId: "@voyant-travel/notifications#admin.route.preview",
        label: { namespace: "notifications.admin", key: "admin.previewPage.title" },
      },
      {
        id: "@voyant-travel/notifications#admin.nav.settings",
        routeId: "@voyant-travel/notifications#admin.route.settings",
        label: { namespace: "notifications.admin", key: "settings.heading" },
      },
    ],
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

/**
 * Selected by Node deployments that activate reminder and confirmation delivery.
 * Contract-backed confirmation dispatch waits for Legal's generated-contract event.
 */
export const notificationsReminderSubscribersVoyantPlugin = defineExtension({
  id: "@voyant-travel/notifications#reminder-subscribers-extension",
  packageName: "@voyant-travel/notifications",
  localId: "notifications.reminder-subscribers-extension",
  runtime: {
    entry: "@voyant-travel/notifications",
    export: "createNotificationsSubscribersVoyantRuntime",
  },
  runtimePorts: [requirePort(notificationsRuntimePort)],
  subscribers: [
    {
      id: "@voyant-travel/notifications#subscriber.booking-confirmation-auto-dispatch",
      eventType: "booking.contract.generated",
      source: "@voyant-travel/notifications/subscriber-runtime",
      runtime: {
        entry: "@voyant-travel/notifications/subscriber-runtime",
        export: "notificationsBookingConfirmationAutoDispatchSubscriber",
      },
    },
    {
      id: "@voyant-travel/notifications#subscriber.reminder-booking-confirmed",
      eventType: "booking.confirmed",
      source: "@voyant-travel/notifications/subscriber-runtime",
      runtime: {
        entry: "@voyant-travel/notifications/subscriber-runtime",
        export: "notificationsBookingConfirmedReminderSubscriber",
      },
    },
    {
      id: "@voyant-travel/notifications#subscriber.reminder-payment-completed",
      eventType: "payment.completed",
      source: "@voyant-travel/notifications/subscriber-runtime",
      runtime: {
        entry: "@voyant-travel/notifications/subscriber-runtime",
        export: "notificationsPaymentCompletedReminderSubscriber",
      },
    },
    {
      id: "@voyant-travel/notifications#subscriber.document-lifecycle-booking-fully-paid",
      eventType: "booking.fully-paid",
      source: "@voyant-travel/notifications/subscriber-runtime",
      runtime: {
        entry: "@voyant-travel/notifications/subscriber-runtime",
        export: "notificationsBookingFullyPaidDocumentLifecycleSubscriber",
      },
    },
    {
      id: "@voyant-travel/notifications#subscriber.reminder-booking-cancelled",
      eventType: "booking.cancelled",
      source: "@voyant-travel/notifications/subscriber-runtime",
      runtime: {
        entry: "@voyant-travel/notifications/subscriber-runtime",
        export: "notificationsBookingCancelledReminderSubscriber",
      },
    },
    {
      id: "@voyant-travel/notifications#subscriber.reminder-booking-expired",
      eventType: "booking.expired",
      source: "@voyant-travel/notifications/subscriber-runtime",
      runtime: {
        entry: "@voyant-travel/notifications/subscriber-runtime",
        export: "notificationsBookingExpiredReminderSubscriber",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default notificationsVoyantModule
