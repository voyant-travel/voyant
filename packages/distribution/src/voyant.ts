import {
  catalogDistributionRuntimeExtensionPort,
  catalogRuntimeServicesPort,
} from "@voyant-travel/catalog/ports"
import {
  defineExtension,
  defineModule,
  providePort,
  requirePort,
} from "@voyant-travel/core/project"
import { financeDistributionPaymentPolicyRuntimePort } from "@voyant-travel/finance/runtime-port"
import { channelPushRuntimePort } from "./channel-push/runtime-port.js"

const productPublicationChangedEventPayloadSchema = {
  type: "object",
  properties: {
    productId: { type: "string" },
    channelId: { type: "string" },
    mappingId: { type: ["string", "null"] },
    previousActive: { type: ["boolean", "null"] },
    nextActive: { type: ["boolean", "null"] },
    operation: {
      type: "string",
      enum: ["created", "updated", "deleted", "activated", "deactivated"],
    },
    channelKind: { type: ["string", "null"] },
    channelStatus: { type: ["string", "null"] },
  },
  required: [
    "productId",
    "channelId",
    "mappingId",
    "previousActive",
    "nextActive",
    "operation",
    "channelKind",
    "channelStatus",
  ],
  additionalProperties: false,
} as const

const supplierLifecycleEventPayloadSchema = {
  type: "object",
  properties: { id: { type: "string" } },
  required: ["id"],
  additionalProperties: false,
} as const

/** Import-cheap deployment declarations owned by the distribution package. */
export const distributionVoyantModule = defineModule({
  id: "@voyant-travel/distribution",
  packageName: "@voyant-travel/distribution",
  localId: "distribution",
  provides: {
    ports: [
      providePort(channelPushRuntimePort),
      providePort(catalogDistributionRuntimeExtensionPort),
      providePort(financeDistributionPaymentPolicyRuntimePort),
    ],
  },
  requires: { ports: [requirePort(catalogRuntimeServicesPort)] },
  api: [
    {
      id: "@voyant-travel/distribution#api.external-refs",
      surface: "admin",
      mount: "external-refs",
      openapi: { document: "external-refs" },
      runtime: {
        entry: "@voyant-travel/distribution",
        export: "externalRefsHonoModule",
      },
    },
    {
      id: "@voyant-travel/distribution#api",
      surface: "admin",
      mount: "distribution",
      openapi: { document: "distribution" },
      runtime: {
        entry: "@voyant-travel/distribution",
        export: "distributionHonoModule",
      },
    },
    {
      id: "@voyant-travel/distribution#api.suppliers",
      surface: "admin",
      mount: "suppliers",
      openapi: { document: "suppliers" },
      runtime: {
        entry: "@voyant-travel/distribution",
        export: "suppliersHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/distribution#schema",
      source: "@voyant-travel/distribution/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/distribution#migrations",
      source: "./migrations",
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/distribution#access.external-refs",
        resource: "external-refs",
        label: "External references",
        description: "Mappings between Voyant records and identifiers in external systems.",
        actions: [
          {
            action: "read",
            label: "View external references",
            description: "View external-system identifier mappings.",
          },
          {
            action: "write",
            label: "Manage external references",
            description: "Create and update external-system identifier mappings.",
          },
          {
            action: "delete",
            label: "Delete external references",
            description: "Delete external-system identifier mappings.",
            sensitive: true,
          },
        ],
      },
      {
        id: "@voyant-travel/distribution#access.distribution",
        resource: "distribution",
        label: "Distribution",
        description: "Channels, contracts, mappings, inventory, settlements, and delivery state.",
        actions: [
          {
            action: "read",
            label: "View distribution",
            description: "View channel configuration, mappings, inventory, and delivery state.",
          },
          {
            action: "write",
            label: "Manage distribution",
            description: "Create, update, reconcile, and retry distribution records.",
          },
          {
            action: "delete",
            label: "Delete distribution records",
            description: "Delete supported channel, mapping, inventory, and settlement records.",
            sensitive: true,
          },
        ],
      },
      {
        id: "@voyant-travel/distribution#access.suppliers",
        resource: "suppliers",
        label: "Suppliers",
        description: "Supplier profiles, contacts, services, rates, notes, and commercial terms.",
        actions: [
          {
            action: "read",
            label: "View suppliers",
            description: "View supplier profiles and related commercial records.",
          },
          {
            action: "write",
            label: "Manage suppliers",
            description: "Create and update supplier profiles and related commercial records.",
          },
          {
            action: "delete",
            label: "Delete supplier records",
            description: "Delete suppliers and supported supplier-owned records.",
            sensitive: true,
          },
        ],
      },
    ],
  },
  links: [
    {
      id: "@voyant-travel/distribution#linkable.supplier",
      source: "@voyant-travel/distribution/linkables",
    },
  ],
  events: [
    {
      id: "@voyant-travel/distribution#event.product-publication-changed",
      eventType: "product.publication.changed",
      version: "1.0.0",
      payloadSchema: productPublicationChangedEventPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "distribution", category: "domain" },
    },
    {
      id: "@voyant-travel/distribution#event.supplier-created",
      eventType: "supplier.created",
      version: "1.0.0",
      payloadSchema: supplierLifecycleEventPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "distribution", category: "domain" },
    },
    {
      id: "@voyant-travel/distribution#event.supplier-updated",
      eventType: "supplier.updated",
      version: "1.0.0",
      payloadSchema: supplierLifecycleEventPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "distribution", category: "domain" },
    },
    {
      id: "@voyant-travel/distribution#event.supplier-deleted",
      eventType: "supplier.deleted",
      version: "1.0.0",
      payloadSchema: supplierLifecycleEventPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "distribution", category: "domain" },
    },
  ],
  admin: {
    compositionOrder: 30,
    runtime: {
      entry: "@voyant-travel/distribution-react/admin",
      export: "createSelectedDistributionAdminExtension",
    },
    copy: [
      {
        id: "@voyant-travel/distribution#admin.copy",
        namespace: "distribution.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/distribution-react/i18n",
          export: "distributionUiMessageDefinitions",
        },
      },
    ],
    routes: [
      {
        id: "@voyant-travel/distribution#admin.route.suppliers-index",
        path: "/suppliers",
        requiredScopes: ["suppliers:read"],
        runtime: {
          entry: "@voyant-travel/distribution-react/admin",
          export: "createDistributionAdminExtension",
        },
      },
      {
        id: "@voyant-travel/distribution#admin.route.suppliers-detail",
        path: "/suppliers/$id",
        requiredScopes: ["suppliers:read"],
        runtime: {
          entry: "@voyant-travel/distribution-react/admin",
          export: "createDistributionAdminExtension",
        },
      },
    ],
    nav: [
      {
        id: "@voyant-travel/distribution#admin.nav.suppliers",
        routeId: "@voyant-travel/distribution#admin.route.suppliers-index",
        label: { namespace: "operator.admin.navigation", key: "nav.suppliers" },
      },
    ],
    slots: [
      {
        id: "supplier.details.payment-policy",
        routeId: "@voyant-travel/distribution#admin.route.suppliers-detail",
        contract: { supplierId: "string" },
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

export const distributionBookingVoyantPlugin = defineExtension({
  id: "@voyant-travel/distribution#extension",
  packageName: "@voyant-travel/distribution",
  localId: "distribution",
  api: [
    {
      id: "@voyant-travel/distribution#extension.api",
      surface: "admin",
      mount: "bookings",
      openapi: { document: "distribution-booking" },
      runtime: {
        entry: "@voyant-travel/distribution",
        export: "distributionBookingExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const distributionChannelPushVoyantPlugin = defineExtension({
  id: "@voyant-travel/distribution#channel-push-extension",
  packageName: "@voyant-travel/distribution",
  localId: "distribution.channel-push-extension",
  runtimePorts: [requirePort(channelPushRuntimePort)],
  api: [
    {
      id: "@voyant-travel/distribution#channel-push-extension.api",
      surface: "admin",
      mount: "distribution",
      openapi: { document: "distribution-channel-push" },
      runtime: {
        entry: "@voyant-travel/distribution",
        export: "createChannelPushVoyantRuntime",
      },
    },
  ],
  admin: {
    runtime: {
      entry: "@voyant-travel/distribution-react/admin",
      export: "createSelectedDistributionChannelPushAdminExtension",
    },
    routes: [
      {
        id: "@voyant-travel/distribution#channel-push-extension.admin.route.channel-sync",
        path: "/channel-sync",
        requiredScopes: ["distribution:read"],
        runtime: {
          entry: "@voyant-travel/distribution-react/admin",
          export: "createDistributionChannelPushAdminExtension",
        },
      },
    ],
    nav: [
      {
        id: "@voyant-travel/distribution#channel-push-extension.admin.nav.channel-sync",
        routeId: "@voyant-travel/distribution#channel-push-extension.admin.route.channel-sync",
        label: { namespace: "operator.admin.navigation", key: "nav.channelSync" },
      },
    ],
  },
  subscribers: [
    {
      id: "@voyant-travel/distribution#subscriber.channel-push-booking-confirmed",
      eventType: "booking.confirmed",
      source: "@voyant-travel/distribution",
      runtime: {
        entry: "@voyant-travel/distribution/channel-push-subscribers",
        export: "channelPushBookingConfirmedSubscriber",
      },
    },
    {
      id: "@voyant-travel/distribution#subscriber.channel-push-availability-changed",
      eventType: "availability.slot.changed",
      source: "@voyant-travel/distribution",
      runtime: {
        entry: "@voyant-travel/distribution/channel-push-subscribers",
        export: "channelPushAvailabilityChangedSubscriber",
      },
    },
    {
      id: "@voyant-travel/distribution#subscriber.channel-push-content-changed",
      eventType: "product.content.changed",
      source: "@voyant-travel/distribution",
      runtime: {
        entry: "@voyant-travel/distribution/channel-push-subscribers",
        export: "channelPushContentChangedSubscriber",
      },
    },
  ],
  workflows: [
    {
      id: "channel.booking.push",
      config: { defaultRuntime: "node" },
      source: "@voyant-travel/distribution/channel-push-workflows",
      runtime: {
        entry: "@voyant-travel/distribution/channel-push-workflows",
        export: "channelBookingPushWorkflow",
      },
    },
    {
      id: "channel.availability.push",
      config: { defaultRuntime: "node" },
      source: "@voyant-travel/distribution/channel-push-workflows",
      runtime: {
        entry: "@voyant-travel/distribution/channel-push-workflows",
        export: "channelAvailabilityPushWorkflow",
      },
    },
    {
      id: "channel.content.push",
      config: { defaultRuntime: "node" },
      source: "@voyant-travel/distribution/channel-push-workflows",
      runtime: {
        entry: "@voyant-travel/distribution/channel-push-workflows",
        export: "channelContentPushWorkflow",
      },
    },
    {
      id: "distribution.channel-push-reconcile-booking-links",
      config: { defaultRuntime: "node" },
      schedules: [
        {
          id: "channel-push-booking-link",
          workflowId: "distribution.channel-push-reconcile-booking-links",
          cron: "*/15 * * * *",
          name: "booking-links",
        },
      ],
      runtime: {
        entry: "@voyant-travel/distribution/channel-push-workflows",
        export: "channelPushBookingLinkReconcileWorkflow",
      },
    },
    {
      id: "distribution.channel-push-reconcile-availability",
      config: { defaultRuntime: "node" },
      schedules: [
        {
          id: "channel-push-availability",
          workflowId: "distribution.channel-push-reconcile-availability",
          cron: "0 * * * *",
          name: "hourly",
        },
      ],
      runtime: {
        entry: "@voyant-travel/distribution/channel-push-workflows",
        export: "channelPushAvailabilityReconcileWorkflow",
      },
    },
    {
      id: "distribution.channel-push-reconcile-content",
      config: { defaultRuntime: "node" },
      schedules: [
        {
          id: "channel-push-content",
          workflowId: "distribution.channel-push-reconcile-content",
          cron: "0 3 * * *",
          name: "nightly",
        },
      ],
      runtime: {
        entry: "@voyant-travel/distribution/channel-push-workflows",
        export: "channelPushContentReconcileWorkflow",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default distributionVoyantModule
