import { defineModule } from "@voyant-travel/core/project"

const schemaSource = "@voyant-travel/notifications/schema"

/** Import-cheap deployment declaration owned by the notifications package. */
export const notificationsVoyantModule = defineModule({
  id: "@voyant-travel/notifications",
  packageName: "@voyant-travel/notifications",
  localId: "notifications",
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
  meta: {
    ownership: "package",
  },
})

export default notificationsVoyantModule
