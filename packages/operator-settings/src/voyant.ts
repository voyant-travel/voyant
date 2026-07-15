import { commerceOperatorSettingsRuntimePort } from "@voyant-travel/commerce/runtime-port"
import { defineModule, providePort } from "@voyant-travel/core/project"
import { financeOperatorSettingsRuntimePort } from "@voyant-travel/finance/runtime-port"

const runtime = {
  entry: "@voyant-travel/operator-settings/hono-module",
  export: "createOperatorSettingsHonoModule",
} as const

const operatorSettingsAdminRuntime = {
  entry: "@voyant-travel/operator-settings-react/settings",
  export: "createSelectedOperatorSettingsAdminExtension",
} as const

/** Import-cheap deployment declaration owned by the operator-settings package. */
export const operatorSettingsVoyantModule = defineModule({
  id: "@voyant-travel/operator-settings",
  packageName: "@voyant-travel/operator-settings",
  localId: "operator-settings",
  provides: {
    ports: [
      providePort(commerceOperatorSettingsRuntimePort),
      providePort(financeOperatorSettingsRuntimePort),
    ],
  },
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
  access: {
    resources: [
      {
        id: "@voyant-travel/operator-settings#access.settings",
        resource: "settings",
        label: "Settings",
        description: "Manage operator profile and application settings.",
        actions: [
          {
            action: "read",
            label: "View settings",
            description: "View operator profile and application settings.",
          },
          {
            action: "write",
            label: "Manage settings",
            description: "Create and update operator profile and application settings.",
          },
          {
            action: "delete",
            label: "Delete settings",
            description: "Delete operator-managed settings.",
            sensitive: true,
          },
        ],
      },
    ],
  },
  tools: [
    {
      id: "@voyant-travel/operator-settings#tool.get-operator-settings",
      name: "get_operator_settings",
      runtime: {
        entry: "@voyant-travel/operator-settings/tools",
        export: "getOperatorSettingsTool",
      },
      requiredScopes: ["settings:read"],
      context: ["operatorSettings"],
      risk: "low",
    },
    {
      id: "@voyant-travel/operator-settings#tool.update-operator-settings",
      name: "update_operator_settings",
      runtime: {
        entry: "@voyant-travel/operator-settings/tools",
        export: "updateOperatorSettingsTool",
      },
      requiredScopes: ["settings:write"],
      context: ["operatorSettings"],
      risk: "high",
    },
  ],
  actions: [
    {
      id: "@voyant-travel/operator-settings#action.update-operator-settings",
      version: "v1",
      kind: "execute",
      targetType: "operator-settings",
      resource: "settings",
      action: "write",
      requiredScopes: ["settings:write"],
      risk: "high",
      ledger: "required",
      approval: "required",
      reversible: true,
      from: { tools: ["@voyant-travel/operator-settings#tool.update-operator-settings"] },
    },
  ],
  admin: {
    compositionOrder: 10,
    runtime: operatorSettingsAdminRuntime,
    routes: [
      {
        id: "@voyant-travel/operator-settings#admin.route.operator-profile",
        path: "/settings/operator",
        runtime: operatorSettingsAdminRuntime,
      },
    ],
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default operatorSettingsVoyantModule
