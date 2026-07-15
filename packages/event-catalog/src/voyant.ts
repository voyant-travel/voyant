import { defineModule } from "@voyant-travel/core/project"

const eventCatalogAdminRuntime = {
  entry: "@voyant-travel/event-catalog-react/admin",
  export: "createSelectedEventCatalogAdminExtension",
} as const

/** Infrastructure module exposing selected package event contracts without owning them. */
export const eventCatalogVoyantModule = defineModule({
  id: "@voyant-travel/event-catalog",
  packageName: "@voyant-travel/event-catalog",
  localId: "event-catalog",
  api: [
    {
      id: "@voyant-travel/event-catalog#api.admin",
      surface: "admin",
      mount: "event-catalog",
      methods: ["GET"],
      resource: "event-catalog",
      openapi: { document: "event-catalog" },
      runtime: {
        entry: "@voyant-travel/event-catalog/runtime",
        export: "createEventCatalogVoyantRuntime",
      },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/event-catalog#access.event-catalog",
        resource: "event-catalog",
        label: "Event catalog",
        description: "Discover event contracts selected for this deployment.",
        actions: [
          {
            action: "read",
            label: "View event contracts",
            description: "View selected event types, versions, schemas, and redacted fields.",
          },
        ],
      },
    ],
  },
  admin: {
    compositionOrder: 180,
    runtime: eventCatalogAdminRuntime,
    copy: [
      {
        id: "@voyant-travel/event-catalog#admin.copy",
        namespace: "event-catalog.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/event-catalog-react/i18n",
          export: "eventCatalogMessageDefinitions",
        },
      },
    ],
    routes: [
      {
        id: "@voyant-travel/event-catalog#admin.route.docs",
        path: "/docs/events",
        requiredScopes: ["event-catalog:read"],
        runtime: eventCatalogAdminRuntime,
      },
    ],
    nav: [
      {
        id: "@voyant-travel/event-catalog#admin.nav.docs",
        routeId: "@voyant-travel/event-catalog#admin.route.docs",
        label: { namespace: "event-catalog.admin", key: "navigation.title" },
        order: 180,
      },
    ],
  },
  meta: {
    ownership: "package",
    agentTools: {
      posture: "not-applicable",
      rationale:
        "The event catalog is runtime contract metadata; domain Tools expose actionable behavior.",
    },
  },
})

export default eventCatalogVoyantModule
