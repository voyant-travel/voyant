import { describe, expect, it } from "vitest"
import { notificationsVoyantModule } from "../../src/voyant.js"

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
})
