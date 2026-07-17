import { defineModule } from "@voyant-travel/core/project"

const appsAdminRuntime = {
  entry: "@voyant-travel/apps-react/admin",
  export: "createSelectedAppsAdminExtension",
} as const

const appInstallationLifecyclePayloadSchema = {
  type: "object",
  additionalProperties: false,
  required: ["appId", "installationId", "deploymentId"],
  properties: {
    appId: { type: "string" },
    installationId: { type: "string" },
    deploymentId: { type: "string" },
  },
} as const

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
  events: [
    {
      id: "@voyant-travel/apps#event.installation-active",
      eventType: "app.installation.active",
      version: "1.0.0",
      payloadSchema: appInstallationLifecyclePayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "apps", category: "internal" },
    },
    {
      id: "@voyant-travel/apps#event.installation-upgraded",
      eventType: "app.installation.upgraded",
      version: "1.0.0",
      payloadSchema: appInstallationLifecyclePayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "apps", category: "internal" },
    },
    {
      id: "@voyant-travel/apps#event.installation-upgrade-pending",
      eventType: "app.installation.upgrade_pending",
      version: "1.0.0",
      payloadSchema: appInstallationLifecyclePayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "apps", category: "internal" },
    },
    {
      id: "@voyant-travel/apps#event.installation-paused",
      eventType: "app.installation.paused",
      version: "1.0.0",
      payloadSchema: appInstallationLifecyclePayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "apps", category: "internal" },
    },
    {
      id: "@voyant-travel/apps#event.installation-uninstalled",
      eventType: "app.installation.uninstalled",
      version: "1.0.0",
      payloadSchema: appInstallationLifecyclePayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "apps", category: "internal" },
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
  admin: {
    compositionOrder: 170,
    runtime: appsAdminRuntime,
    copy: [
      {
        id: "@voyant-travel/apps#admin.copy",
        namespace: "apps.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/apps-react/i18n",
          export: "appsUiMessageDefinitions",
        },
      },
    ],
    routes: [
      {
        id: "@voyant-travel/apps#admin.route.installed",
        path: "/apps",
        requiredScopes: ["apps:read"],
        runtime: appsAdminRuntime,
      },
      {
        id: "@voyant-travel/apps#admin.route.developer",
        path: "/apps/developer",
        requiredScopes: ["apps:write"],
        runtime: appsAdminRuntime,
      },
    ],
    nav: [
      {
        id: "@voyant-travel/apps#admin.nav.installed",
        routeId: "@voyant-travel/apps#admin.route.installed",
        label: { namespace: "apps.admin", key: "navigation.title" },
        order: 170,
      },
      {
        id: "@voyant-travel/apps#admin.nav.developer",
        routeId: "@voyant-travel/apps#admin.route.developer",
        label: { namespace: "apps.admin", key: "navigation.developerTitle" },
        order: 171,
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
