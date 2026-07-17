import { defineModule } from "@voyant-travel/core/project"

export const appsVoyantModule = defineModule({
  id: "@voyant-travel/apps",
  packageName: "@voyant-travel/apps",
  localId: "apps",
  api: [
    {
      id: "@voyant-travel/apps#api.admin",
      surface: "admin",
      mount: "apps",
      resource: "apps",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/apps/api-runtime",
        export: "createAppsApiModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/apps#schema",
      source: "@voyant-travel/apps/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/apps#migrations",
      source: "./migrations",
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/apps#access.apps",
        resource: "apps",
        label: "Apps",
        description: "Administer app registrations and immutable app releases.",
        actions: [
          {
            action: "read",
            label: "View apps",
            description: "View app registrations and releases.",
          },
          {
            action: "write",
            label: "Administer apps",
            description: "Create custom app registrations and immutable app releases.",
            sensitive: true,
          },
        ],
      },
    ],
  },
  lifecycle: { uninstall: { default: "retain-data", purge: "not-supported" } },
  meta: {
    ownership: "package",
    agentTools: {
      posture: "not-applicable",
      rationale:
        "The app registry is an authenticated admin API surface; this module does not expose agent Tools.",
    },
  },
})

export default appsVoyantModule
