import { defineModule, requirePort } from "@voyant-travel/core/project"
import {
  customFieldValueLifecycleRuntimePort,
  customFieldValueOperationsRuntimePort,
} from "@voyant-travel/core/runtime-port"
import { financeAppApiRuntimePort } from "@voyant-travel/finance-contracts/runtime-port"

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
  runtimePorts: [
    requirePort(customFieldValueLifecycleRuntimePort, {
      optional: true,
      cardinality: "many",
    }),
    requirePort(customFieldValueOperationsRuntimePort, {
      optional: true,
      cardinality: "many",
    }),
    requirePort(financeAppApiRuntimePort, { optional: true }),
  ],
  api: [
    {
      id: "@voyant-travel/apps#api.admin",
      surface: "admin",
      mount: "apps",
      openapi: { document: "apps" },
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
        id: "@voyant-travel/apps#access.app-installation",
        resource: "app-installation",
        label: "App installation",
        description: "Read the calling app installation and grant state.",
        remoteSafe: true,
        actions: [{ action: "read", label: "Read installation", description: "Read self." }],
      },
      {
        id: "@voyant-travel/apps#access.custom-field-definitions",
        resource: "custom-field-definitions",
        label: "Own custom-field definitions",
        description: "Read and write custom-field definitions owned by the app.",
        remoteSafe: true,
        actions: [
          {
            action: "read",
            label: "Read custom-field definitions",
            description: "Read definitions owned by the app.",
          },
          {
            action: "write",
            label: "Write custom-field definitions",
            description: "Create and update definitions owned by the app.",
          },
        ],
        wildcard: "explicit-resource",
      },
      {
        id: "@voyant-travel/apps#access.custom-field-values",
        resource: "custom-field-values",
        label: "Own custom-field values",
        description: "Read and write app-owned custom-field values by target.",
        remoteSafe: true,
        actions: [
          {
            action: "read",
            label: "Read custom-field values",
            description: "Read custom-field values owned by the app.",
          },
          {
            action: "write",
            label: "Write custom-field values",
            description: "Write custom-field values owned by the app.",
          },
          {
            action: "booking",
            label: "Booking custom fields",
            description: "Access app-owned custom-field values on bookings.",
          },
          {
            action: "person",
            label: "Person custom fields",
            description: "Access app-owned custom-field values on people.",
          },
          {
            action: "organization",
            label: "Organization custom fields",
            description: "Access app-owned custom-field values on organizations.",
          },
          {
            action: "invoice",
            label: "Invoice custom fields",
            description: "Access app-owned custom-field values on invoices.",
          },
        ],
        wildcard: "explicit-resource",
      },
      {
        id: "@voyant-travel/apps#access.app-webhooks",
        // Namespaced `app-webhooks` (not `webhooks`) to avoid a duplicate
        // access-resource authority with @voyant-travel/workflow-runs, which
        // owns the deployment `webhooks` resource.
        resource: "app-webhooks",
        label: "App webhooks",
        description: "Read webhook health and request replay.",
        remoteSafe: true,
        actions: [
          {
            action: "read",
            label: "Read app webhooks",
            description: "Read app webhook subscription and delivery health.",
          },
          { action: "replay", label: "Replay webhooks", description: "Replay deliveries." },
        ],
      },
      {
        id: "@voyant-travel/apps#access.app-audit",
        resource: "app-audit",
        label: "App audit history",
        description: "Read audit history owned by the app.",
        remoteSafe: true,
        actions: [
          {
            action: "read",
            label: "Read app audit history",
            description: "Read audit events owned by the app.",
          },
        ],
      },
      {
        id: "@voyant-travel/apps#access.online-token",
        resource: "online-token",
        label: "Online token exchange",
        description: "Exchange admin session context for online app access.",
        remoteSafe: true,
        actions: [
          {
            action: "exchange",
            label: "Exchange online token",
            description: "Exchange admin session context for online app access.",
            wildcard: "explicit",
          },
        ],
      },
      {
        id: "@voyant-travel/apps#access.finance-documents",
        resource: "finance-documents",
        label: "Finance documents",
        description: "Read finance documents visible to remote accounting apps.",
        remoteSafe: true,
        actions: [
          {
            action: "read",
            label: "Read finance documents",
            description: "Read finance documents visible to the app.",
          },
        ],
        wildcard: "explicit-resource",
      },
      {
        id: "@voyant-travel/apps#access.finance-actions",
        resource: "finance-actions",
        label: "Finance actions",
        description: "Request approved finance document actions.",
        remoteSafe: true,
        actions: [
          {
            action: "issue",
            label: "Issue finance documents",
            description: "Request approved finance document issuance.",
            sensitive: true,
            wildcard: "explicit",
          },
          {
            action: "retry",
            label: "Retry finance actions",
            description: "Request approved finance action retry.",
            sensitive: true,
            wildcard: "explicit",
          },
          {
            action: "reconcile",
            label: "Reconcile finance documents",
            description: "Request approved finance document reconciliation.",
            sensitive: true,
            wildcard: "explicit",
          },
        ],
        wildcard: "explicit-resource",
      },
      {
        id: "@voyant-travel/apps#access.finance-external-references",
        resource: "finance-external-references",
        label: "Finance external references",
        description: "Read and record provider-owned finance document references.",
        remoteSafe: true,
        actions: [
          {
            action: "read",
            label: "Read external references",
            description: "Read the app provider's reference for a finance document.",
          },
          {
            action: "write",
            label: "Write external references",
            description: "Idempotently record the app provider's finance document reference.",
            sensitive: true,
            wildcard: "explicit",
          },
        ],
        wildcard: "explicit-resource",
      },
      {
        id: "@voyant-travel/apps#access.finance-external-allocation",
        resource: "finance-external-allocation",
        label: "External finance number allocation",
        description: "Write a provider-owned number to a pending finance document.",
        remoteSafe: true,
        actions: [
          {
            action: "write",
            label: "Allocate external finance number",
            description: "Atomically finalize a pending provider-owned document number.",
            sensitive: true,
            wildcard: "explicit",
          },
        ],
        wildcard: "explicit-resource",
      },
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
