import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"
import { channelPushRuntimePort } from "./channel-push/runtime-port.js"

/** Import-cheap deployment declarations owned by the distribution package. */
export const distributionVoyantModule = defineModule({
  id: "@voyant-travel/distribution",
  packageName: "@voyant-travel/distribution",
  localId: "distribution",
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
        id: "@voyant-travel/distribution#access.suppliers",
        resource: "suppliers",
        actions: ["read", "write"],
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
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "distribution", category: "domain" },
    },
    {
      id: "@voyant-travel/distribution#event.supplier-created",
      eventType: "supplier.created",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "distribution", category: "domain" },
    },
    {
      id: "@voyant-travel/distribution#event.supplier-updated",
      eventType: "supplier.updated",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "distribution", category: "domain" },
    },
    {
      id: "@voyant-travel/distribution#event.supplier-deleted",
      eventType: "supplier.deleted",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
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
        id: "@voyant-travel/distribution#admin.route.channel-sync",
        path: "/channel-sync",
        runtime: {
          entry: "@voyant-travel/distribution-react/admin",
          export: "createDistributionAdminExtension",
        },
      },
      {
        id: "@voyant-travel/distribution#admin.route.suppliers-index",
        path: "/suppliers",
        runtime: {
          entry: "@voyant-travel/distribution-react/admin",
          export: "createDistributionAdminExtension",
        },
      },
      {
        id: "@voyant-travel/distribution#admin.route.suppliers-detail",
        path: "/suppliers/$id",
        runtime: {
          entry: "@voyant-travel/distribution-react/admin",
          export: "createDistributionAdminExtension",
        },
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
  subscribers: [
    {
      id: "@voyant-travel/distribution#subscriber.channel-push-booking-confirmed",
      eventType: "booking.confirmed",
      source: "@voyant-travel/distribution",
      runtime: {
        entry: "./channel-push-subscribers",
        export: "channelPushBookingConfirmedSubscriber",
      },
    },
    {
      id: "@voyant-travel/distribution#subscriber.channel-push-availability-changed",
      eventType: "availability.slot.changed",
      source: "@voyant-travel/distribution",
      runtime: {
        entry: "./channel-push-subscribers",
        export: "channelPushAvailabilityChangedSubscriber",
      },
    },
    {
      id: "@voyant-travel/distribution#subscriber.channel-push-content-changed",
      eventType: "product.content.changed",
      source: "@voyant-travel/distribution",
      runtime: {
        entry: "./channel-push-subscribers",
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
