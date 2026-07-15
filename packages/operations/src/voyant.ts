import { catalogOperationsRuntimeExtensionPort } from "@voyant-travel/catalog/ports"
import { defineModule, providePort } from "@voyant-travel/core/project"

const operationsAdminRuntime = {
  entry: "@voyant-travel/operations-react/admin",
  export: "createOperationsAdminExtension",
} as const

const availabilitySlotChangedEventPayloadSchema = {
  type: "object",
  properties: {
    slotId: { type: "string" },
    productId: { type: "string" },
    optionId: { type: ["string", "null"] },
    startsAt: { type: "string", format: "date-time" },
    remainingPax: { type: ["number", "null"] },
    unlimited: { type: "boolean" },
    source: {
      type: "string",
      enum: ["booking", "cancel", "expire", "modify", "manual", "refresh", "created", "deleted"],
    },
  },
  required: ["slotId", "productId", "optionId", "startsAt", "remainingPax", "unlimited", "source"],
  additionalProperties: false,
} as const

/** Import-cheap deployment declaration owned by the operations package. */
export const operationsVoyantModule = defineModule({
  id: "@voyant-travel/operations",
  packageName: "@voyant-travel/operations",
  localId: "operations",
  provides: { ports: [providePort(catalogOperationsRuntimeExtensionPort)] },
  api: [
    {
      id: "@voyant-travel/operations#api.admin",
      surface: "admin",
      mount: "operations",
      openapi: { document: "operations" },
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
      kind: "linkable",
      source: "@voyant-travel/operations/linkables",
    },
    {
      id: "@voyant-travel/operations#linkable.facility",
      kind: "linkable",
      source: "@voyant-travel/operations/linkables",
    },
    {
      id: "@voyant-travel/operations#linkable.functionSpace",
      kind: "linkable",
      source: "@voyant-travel/operations/linkables",
    },
    {
      id: "@voyant-travel/operations#linkable.property",
      kind: "linkable",
      source: "@voyant-travel/operations/linkables",
    },
    {
      id: "@voyant-travel/operations#linkable.spaceBlock",
      kind: "linkable",
      source: "@voyant-travel/operations/linkables",
    },
  ],
  events: [
    {
      id: "@voyant-travel/operations#event.availability-slot-changed",
      eventType: "availability.slot.changed",
      version: "1.0.0",
      payloadSchema: availabilitySlotChangedEventPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "operations", category: "domain" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/operations#access.operations",
        resource: "operations",
        label: "Operations",
        description: "Availability, resources, facilities, properties, and ground operations.",
        actions: [
          {
            action: "read",
            label: "View operations",
            description: "View availability and operational resources, places, and services.",
          },
          {
            action: "write",
            label: "Manage operations",
            description: "Create and update availability and operational records.",
          },
          {
            action: "delete",
            label: "Delete operational records",
            description: "Delete supported availability, resource, place, and service records.",
            sensitive: true,
          },
        ],
      },
    ],
  },
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
      requiredScopes: ["operations:read"],
      runtime: operationsAdminRuntime,
    })),
    contributions: [
      {
        id: "@voyant-travel/operations#admin.contribution.product-option-resource-templates",
        slotId: "product.details.option-extras",
        requiredScopes: ["operations:read"],
        runtime: operationsAdminRuntime,
      },
    ],
    nav: [
      {
        id: "@voyant-travel/operations#admin.nav.availability",
        routeId: "@voyant-travel/operations#admin.route.availability-index",
        label: { namespace: "operator.admin.navigation", key: "nav.availability" },
      },
      {
        id: "@voyant-travel/operations#admin.nav.resources",
        routeId: "@voyant-travel/operations#admin.route.resources-index",
        label: { namespace: "operator.admin.navigation", key: "nav.resources" },
      },
    ],
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
    agentTools: {
      posture: "planned",
      rationale:
        "Operational dashboards, departures, and cross-module projections need composed Tools.",
      issue: "#3370",
    },
  },
})

export default operationsVoyantModule
