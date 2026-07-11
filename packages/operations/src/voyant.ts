import { defineModule } from "@voyant-travel/core/project"

const operationsAdminRuntime = {
  entry: "@voyant-travel/operations-react/admin",
  export: "createOperationsAdminExtension",
} as const

/** Import-cheap deployment declaration owned by the operations package. */
export const operationsVoyantModule = defineModule({
  id: "@voyant-travel/operations",
  packageName: "@voyant-travel/operations",
  localId: "operations",
  api: [
    {
      id: "@voyant-travel/operations#api.admin",
      surface: "admin",
      mount: "operations",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/operations",
        export: "operationsHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/operations#schema",
      source: "@voyant-travel/operations/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/operations#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/operations#linkable.departure",
      source: "@voyant-travel/operations/availability",
    },
    {
      id: "@voyant-travel/operations#linkable.facility",
      source: "@voyant-travel/operations/places/linkables",
    },
    {
      id: "@voyant-travel/operations#linkable.functionSpace",
      source: "@voyant-travel/operations/places/linkables",
    },
    {
      id: "@voyant-travel/operations#linkable.property",
      source: "@voyant-travel/operations/places/linkables",
    },
    {
      id: "@voyant-travel/operations#linkable.spaceBlock",
      source: "@voyant-travel/operations/places/linkables",
    },
  ],
  events: [
    {
      id: "@voyant-travel/operations#event.availability-slot-changed",
      eventType: "availability.slot.changed",
    },
  ],
  admin: {
    compositionOrder: 10,
    runtime: {
      entry: "@voyant-travel/operations-react/admin",
      export: "createSelectedOperationsAdminExtension",
    },
    copy: [
      {
        id: "@voyant-travel/operations#admin.copy.availability",
        namespace: "operations.availability.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/operations-react/availability/i18n",
          export: "availabilityUiMessageDefinitions",
        },
      },
      {
        id: "@voyant-travel/operations#admin.copy.resources",
        namespace: "operations.resources.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/operations-react/resources/i18n",
          export: "resourcesUiMessageDefinitions",
        },
      },
    ],
    routes: (
      [
        ["availability-index", "/operations/availability"],
        ["availability-slot-detail", "/operations/availability/$id"],
        ["availability-rule-detail", "/operations/availability/rules/$id"],
        ["availability-start-time-detail", "/operations/availability/start-times/$id"],
        ["resources-index", "/operations/resources"],
        ["resources-detail", "/operations/resources/$id"],
        ["resources-pool-detail", "/operations/resources/pools/$id"],
        ["resources-assignment-detail", "/operations/resources/assignments/$id"],
        ["resources-allocation-detail", "/operations/resources/allocations/$id"],
      ] as const
    ).map(([id, path]) => ({
      id: `@voyant-travel/operations#admin.route.${id}`,
      path,
      runtime: operationsAdminRuntime,
    })),
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default operationsVoyantModule
