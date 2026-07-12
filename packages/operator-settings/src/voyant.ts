import { defineModule } from "@voyant-travel/core/project"

const runtime = {
  entry: "@voyant-travel/operator-settings/hono-module",
  export: "createOperatorSettingsHonoModule",
} as const

/** Import-cheap deployment declaration owned by the operator-settings package. */
export const operatorSettingsVoyantModule = defineModule({
  id: "@voyant-travel/operator-settings",
  packageName: "@voyant-travel/operator-settings",
  localId: "operator-settings",
  api: [
    {
      id: "@voyant-travel/operator-settings#api.admin",
      surface: "admin",
      mount: "settings",
      openapi: { document: "operator-settings" },
      runtime,
    },
    {
      id: "@voyant-travel/operator-settings#api.public.operator-profile",
      surface: "public",
      mount: "operator-profile",
      anonymous: true,
      openapi: { document: "operator-settings" },
      runtime,
    },
    {
      id: "@voyant-travel/operator-settings#api.public.settings",
      surface: "public",
      mount: "settings/operator",
      anonymous: true,
      openapi: { document: "operator-settings" },
      runtime,
    },
  ],
  schema: [
    {
      id: "@voyant-travel/operator-settings#schema",
      source: "@voyant-travel/operator-settings/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/operator-settings#migrations",
      source: "./migrations",
    },
  ],
  resources: [
    {
      id: "@voyant-travel/operator-settings#resource.database",
      kind: "database",
      required: true,
      config: { engine: "postgres" },
    },
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default operatorSettingsVoyantModule
