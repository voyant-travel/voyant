import { defineModule } from "@voyant-travel/core/project"

const setupRuntime = {
  entry: "@voyant-travel/setup/hono-module",
  export: "createSetupVoyantRuntime",
} as const

const setupLifecycleChangedEventPayloadSchema = {
  type: "object",
  properties: {
    change: {
      type: "string",
      enum: ["initialized", "step_completed", "step_skipped"],
    },
    stepId: { type: ["string", "null"] },
  },
  required: ["change", "stepId"],
  additionalProperties: false,
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
  events: [
    {
      id: "@voyant-travel/setup#event.lifecycle-changed",
      eventType: "setup.lifecycle.changed",
      version: "1.0.0",
      payloadSchema: setupLifecycleChangedEventPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "setup", category: "internal" },
    },
  ],
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
