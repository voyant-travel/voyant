import { financeNotificationsRuntimePort } from "@voyant-travel/finance/runtime-port"
import { storefrontVerificationRuntimePort } from "@voyant-travel/storefront/runtime-port"
import { quotesNotificationsRuntimePort } from "@voyant-travel/quotes/runtime-port"
import { describe, expect, it } from "vitest"
import {
  NOTIFICATIONS_BOOKING_CONFIRMATION_AUTO_DISPATCH_SUBSCRIBER_ID,
  notificationsReminderSubscriberRuntimeDescriptors,
} from "../../src/subscriber-runtime.js"
import {
  notificationsReminderSubscribersVoyantPlugin,
  notificationsVoyantModule,
} from "../../src/voyant.js"
import {
  createNotificationReminderWorkflows,
  notificationsDeliverReminderWorkflow,
  notificationsSendDueRemindersWorkflow,
} from "../../src/workflow-entry.js"

describe("notifications deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(notificationsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/notifications",
      packageName: "@voyant-travel/notifications",
      provides: {
        capabilities: ["notifications.delivery"],
        ports: [
          { id: storefrontVerificationRuntimePort.id },
          { id: financeNotificationsRuntimePort.id },
          { id: "notifications.runtime" },
          { id: quotesNotificationsRuntimePort.id },
        ],
      },
      runtimePorts: [{ id: "notifications.runtime" }],
      api: [
        {
          id: "@voyant-travel/notifications#api.admin",
          surface: "admin",
          openapi: { document: "notifications" },
          transactional: true,
          runtime: {
            entry: "@voyant-travel/notifications",
            export: "createNotificationsVoyantRuntime",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/notifications#schema" }],
      migrations: [{ id: "@voyant-travel/notifications#migrations" }],
      workflows: [
        {
          id: "notifications.deliver-reminder",
          source: "@voyant-travel/notifications/workflows",
          runtime: {
            entry: "@voyant-travel/notifications/workflows",
            export: "notificationsDeliverReminderWorkflow",
          },
          config: {
            retry: { max: 3, backoff: "exponential", maxDelay: "300s" },
          },
        },
        {
          id: "notifications.send-due-reminders",
          source: "@voyant-travel/notifications/workflows",
          runtime: {
            entry: "@voyant-travel/notifications/workflows",
            export: "notificationsSendDueRemindersWorkflow",
          },
          config: { schedule: { cron: "0 * * * *", name: "hourly" } },
        },
      ],
    })
    expect(notificationsVoyantModule.links?.map((link) => link.id)).toEqual([
      "@voyant-travel/notifications#linkable.notification-template",
      "@voyant-travel/notifications#linkable.notification-delivery",
      "@voyant-travel/notifications#linkable.notification-reminder-rule",
      "@voyant-travel/notifications#linkable.notification-reminder-run",
      "@voyant-travel/notifications#linkable.notification-reminder-rule-stage",
      "@voyant-travel/notifications#linkable.notification-reminder-stage-channel",
      "@voyant-travel/notifications#linkable.notification-settings",
    ])
    expect(notificationsVoyantModule.links?.map((link) => link.export)).toEqual([
      "notificationTemplateLinkable",
      "notificationDeliveryLinkable",
      "notificationReminderRuleLinkable",
      "notificationReminderRunLinkable",
      "notificationReminderRuleStageLinkable",
      "notificationReminderStageChannelLinkable",
      "notificationSettingsLinkable",
    ])
    expect(notificationsVoyantModule.tools?.map((tool) => [tool.name, tool.risk])).toEqual([
      ["list_notification_deliveries", "low"],
      ["get_notification_delivery", "low"],
      ["send_notification", "high"],
    ])
    expect(notificationsVoyantModule.actions).toContainEqual(
      expect.objectContaining({
        id: "@voyant-travel/notifications#action.send-notification",
        resource: "notifications",
        action: "send",
        requiredScopes: ["notifications:send"],
        risk: "high",
        ledger: "required",
        approval: "required",
        reversible: false,
        from: { tools: ["@voyant-travel/notifications#tool.send-notification"] },
      }),
    )
  })

  it("exports workflow runtime descriptors matching the manifest ids", () => {
    expect(notificationsDeliverReminderWorkflow.id).toBe(
      notificationsVoyantModule.workflows?.[0]?.id,
    )
    expect(notificationsSendDueRemindersWorkflow.id).toBe(
      notificationsVoyantModule.workflows?.[1]?.id,
    )
  })

  it("declares concrete payloads for notification-owned events", () => {
    const events = new Map(
      notificationsVoyantModule.events?.map(({ eventType, payloadSchema }) => [
        eventType,
        payloadSchema,
      ]),
    )

    expect(events.get("booking.fully-paid")).toEqual({
      type: "object",
      required: [
        "bookingId",
        "paymentSessionId",
        "invoiceId",
        "amountCents",
        "currency",
        "provider",
      ],
      properties: {
        bookingId: { type: "string" },
        paymentSessionId: { type: "string" },
        invoiceId: { anyOf: [{ type: "string" }, { type: "null" }] },
        amountCents: { type: "number" },
        currency: { type: "string" },
        provider: { type: "string" },
      },
      additionalProperties: false,
    })
    expect(events.get("booking.documents.sent")).toMatchObject({
      required: ["bookingId", "recipient", "deliveryId", "provider", "documentKeys"],
      properties: {
        provider: { anyOf: [{ type: "string" }, { type: "null" }] },
        documentKeys: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    })
  })

  it("scopes admin routes and binds nav to package-owned copy", () => {
    const routes = notificationsVoyantModule.admin?.routes ?? []
    expect(routes).toHaveLength(9)
    expect(
      routes.every(({ requiredScopes }) => requiredScopes?.includes("notifications:read")),
    ).toBe(true)
    expect(notificationsVoyantModule.admin?.nav).toEqual([
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
    ])
  })

  it("publishes ordered confirmation and reminder subscriber runtime references", () => {
    const declarations = notificationsReminderSubscribersVoyantPlugin.subscribers ?? []

    expect(notificationsReminderSubscribersVoyantPlugin).toMatchObject({
      runtime: {
        entry: "@voyant-travel/notifications",
        export: "createNotificationsSubscribersVoyantRuntime",
      },
      runtimePorts: [{ id: "notifications.runtime" }],
    })
    expect(declarations.slice(1).map(({ id, eventType }) => ({ id, eventType }))).toEqual(
      notificationsReminderSubscriberRuntimeDescriptors.map(({ id, eventType }) => ({
        id,
        eventType,
      })),
    )
    expect(declarations.map((subscriber) => subscriber.runtime?.export)).toEqual([
      "notificationsBookingConfirmationAutoDispatchSubscriber",
      "notificationsBookingConfirmedReminderSubscriber",
      "notificationsPaymentCompletedReminderSubscriber",
      "notificationsBookingFullyPaidDocumentLifecycleSubscriber",
      "notificationsBookingCancelledReminderSubscriber",
      "notificationsBookingExpiredReminderSubscriber",
    ])
    expect(declarations[0]?.id).toBe(NOTIFICATIONS_BOOKING_CONFIRMATION_AUTO_DISPATCH_SUBSCRIBER_ID)
    expect(declarations[0]?.eventType).toBe("booking.contract.generated")
  })

  it("preserves configurable reminder workflow factories", () => {
    const definitions = createNotificationReminderWorkflows({
      resolveDb: () => ({}) as never,
      resolveEnv: () => ({}),
      resolveRuntimeOptions: () => ({ providers: [] }),
    })
    expect(definitions.deliverReminderWorkflow.config.retry).toEqual({
      max: 3,
      backoff: "exponential",
      maxDelay: "300s",
    })
    expect(definitions.sendDueRemindersWorkflow.config.schedule).toEqual({
      cron: "0 * * * *",
      name: "hourly",
    })
  })
})
