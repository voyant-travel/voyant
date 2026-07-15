import { defineModule } from "@voyant-travel/core/project"

const runtime = {
  entry: "@voyant-travel/navigation-preferences/hono-module",
  export: "createNavigationPreferencesHonoModule",
} as const

const adminRuntime = {
  entry: "@voyant-travel/navigation-preferences-react/settings",
  export: "createSelectedNavigationPreferencesAdminExtension",
} as const

export const navigationPreferencesVoyantModule = defineModule({
  id: "@voyant-travel/navigation-preferences",
  packageName: "@voyant-travel/navigation-preferences",
  localId: "navigation-preferences",
  api: [
    {
      id: "@voyant-travel/navigation-preferences#api.admin",
      surface: "admin",
      mount: "navigation-preferences",
      resource: "admin-navigation",
      authorization: "route",
      openapi: { document: "navigation-preferences" },
      runtime,
    },
  ],
  schema: [
    {
      id: "@voyant-travel/navigation-preferences#schema",
      source: "@voyant-travel/navigation-preferences/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/navigation-preferences#migrations",
      source: "./migrations",
    },
  ],
  resources: [
    {
      id: "@voyant-travel/navigation-preferences#resource.database",
      kind: "database",
      required: true,
      config: { engine: "postgres" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/navigation-preferences#access.navigation-preferences",
        resource: "admin-navigation",
        label: "Navigation preferences",
        description: "View and manage organization navigation defaults.",
        actions: [
          {
            action: "read",
            label: "View navigation preferences",
            description: "View organization defaults and personal navigation overrides.",
          },
          {
            action: "write",
            label: "Manage organization navigation",
            description: "Set or provision organization navigation defaults.",
            sensitive: true,
          },
        ],
      },
    ],
  },
  admin: {
    compositionOrder: 15,
    runtime: adminRuntime,
    routes: [
      {
        id: "@voyant-travel/navigation-preferences#admin.route.settings",
        path: "/settings/navigation",
        runtime: adminRuntime,
      },
    ],
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: { ownership: "package" },
})

export default navigationPreferencesVoyantModule
