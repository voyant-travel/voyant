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
      runtime: {
        entry: "@voyant-travel/distribution",
        export: "externalRefsHonoModule",
      },
    },
    {
      id: "@voyant-travel/distribution#api",
      surface: "admin",
      mount: "distribution",
      runtime: {
        entry: "@voyant-travel/distribution",
        export: "distributionHonoModule",
      },
    },
    {
      id: "@voyant-travel/distribution#api.suppliers",
      surface: "admin",
      mount: "suppliers",
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
  links: [
    {
      id: "@voyant-travel/distribution#linkable.supplier",
      source: "@voyant-travel/distribution/suppliers/linkables",
    },
  ],
  events: [
    {
      id: "@voyant-travel/distribution#event.product-publication-changed",
      eventType: "product.publication.changed",
    },
    {
      id: "@voyant-travel/distribution#event.supplier-created",
      eventType: "supplier.created",
    },
    {
      id: "@voyant-travel/distribution#event.supplier-updated",
      eventType: "supplier.updated",
    },
    {
      id: "@voyant-travel/distribution#event.supplier-deleted",
      eventType: "supplier.deleted",
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
  ],
  meta: {
    ownership: "package",
  },
})

export default distributionVoyantModule
