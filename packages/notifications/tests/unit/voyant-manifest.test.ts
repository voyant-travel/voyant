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
      api: [
        {
          id: "@voyant-travel/notifications#api.admin",
          surface: "admin",
          transactional: true,
          runtime: {
            entry: "@voyant-travel/notifications",
            export: "createNotificationsHonoModule",
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
  })

  it("exports workflow runtime descriptors matching the manifest ids", () => {
    expect(notificationsDeliverReminderWorkflow.id).toBe(
      notificationsVoyantModule.workflows?.[0]?.id,
    )
    expect(notificationsSendDueRemindersWorkflow.id).toBe(
      notificationsVoyantModule.workflows?.[1]?.id,
    )
  })

  it("keeps reminder subscriber runtime references inert and export-compatible", () => {
    const declarations = notificationsReminderSubscribersVoyantPlugin.subscribers ?? []

    expect(declarations.map(({ id, eventType }) => ({ id, eventType }))).toEqual(
      notificationsReminderSubscriberRuntimeDescriptors.map(({ id, eventType }) => ({
        id,
        eventType,
      })),
    )
    expect(declarations.map((subscriber) => subscriber.runtime?.export)).toEqual([
      "notificationsBookingConfirmedReminderSubscriber",
      "notificationsPaymentCompletedReminderSubscriber",
      "notificationsBookingCancelledReminderSubscriber",
      "notificationsBookingExpiredReminderSubscriber",
    ])
    expect(declarations.map((subscriber) => subscriber.id)).not.toContain(
      NOTIFICATIONS_BOOKING_CONFIRMATION_AUTO_DISPATCH_SUBSCRIBER_ID,
    )
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
