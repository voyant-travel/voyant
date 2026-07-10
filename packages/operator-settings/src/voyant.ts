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
      runtime,
    },
    {
      id: "@voyant-travel/operator-settings#api.public.operator-profile",
      surface: "public",
      mount: "operator-profile",
      anonymous: true,
      runtime,
    },
    {
      id: "@voyant-travel/operator-settings#api.public.settings",
      surface: "public",
      mount: "settings/operator",
      anonymous: true,
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
  meta: {
    ownership: "package",
  },
})

export default operatorSettingsVoyantModule
