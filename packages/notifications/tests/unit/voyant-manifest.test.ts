import { describe, expect, it } from "vitest"
import { notificationsVoyantModule } from "../../src/voyant.js"
import { createNotificationReminderWorkflows } from "../../src/workflow-entry.js"

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
          config: {
            retry: { max: 3, backoff: "exponential", maxDelay: "300s" },
          },
        },
        {
          id: "notifications.send-due-reminders",
          source: "@voyant-travel/notifications/workflows",
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

  it("exposes configurable reminder workflow factories", () => {
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
