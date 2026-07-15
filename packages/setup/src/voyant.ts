import { defineModule } from "@voyant-travel/core/project"

const setupRuntime = {
  entry: "@voyant-travel/setup/hono-module",
  export: "createSetupVoyantRuntime",
} as const

export const setupVoyantModule = defineModule({
  id: "@voyant-travel/setup",
  packageName: "@voyant-travel/setup",
  localId: "setup",
  api: [
    {
      id: "@voyant-travel/setup#api.admin",
      surface: "admin",
      mount: "setup",
      resource: "setup",
      authorization: "route",
      openapi: { document: "setup" },
      runtime: setupRuntime,
    },
  ],
  schema: [{ id: "@voyant-travel/setup#schema", source: "@voyant-travel/setup/schema" }],
  migrations: [{ id: "@voyant-travel/setup#migrations", source: "./migrations" }],
  resources: [
    {
      id: "@voyant-travel/setup#resource.database",
      kind: "database",
      required: true,
      config: { engine: "postgres" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/setup#access.setup",
        resource: "setup",
        label: "Setup",
        description: "View and update organization setup guidance state.",
        actions: [
          { action: "read", label: "View setup", description: "View setup progress." },
          {
            action: "write",
            label: "Manage setup",
            description: "Initialize, complete, and skip setup guidance steps.",
          },
        ],
      },
    ],
  },
  admin: {
    compositionOrder: -1000,
    runtime: {
      entry: "@voyant-travel/setup-react/admin",
      export: "createSelectedSetupAdminExtension",
    },
    routes: [
      {
        id: "@voyant-travel/setup#admin.route.setup",
        path: "/setup",
        runtime: {
          entry: "@voyant-travel/setup-react/admin",
          export: "createSelectedSetupAdminExtension",
        },
      },
    ],
  },
  lifecycle: { uninstall: { default: "retain-data", purge: "not-supported" } },
  meta: { ownership: "package" },
})

export default setupVoyantModule
