import { defineModule, definePlugin } from "@voyant-travel/core/project"

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
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export const distributionBookingVoyantPlugin = definePlugin({
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

export const distributionChannelPushVoyantPlugin = definePlugin({
  id: "@voyant-travel/distribution#channel-push-extension",
  packageName: "@voyant-travel/distribution",
  localId: "distribution.channel-push-extension",
  api: [
    {
      id: "@voyant-travel/distribution#channel-push-extension.api",
      surface: "admin",
      mount: "distribution",
      runtime: {
        entry: "@voyant-travel/distribution",
        export: "createChannelPushExtension",
      },
    },
  ],
  subscribers: [
    {
      id: "@voyant-travel/distribution#subscriber.channel-push-booking-confirmed",
      eventType: "booking.confirmed",
      source: "@voyant-travel/distribution",
    },
    {
      id: "@voyant-travel/distribution#subscriber.channel-push-availability-changed",
      eventType: "availability.slot.changed",
      source: "@voyant-travel/distribution",
    },
    {
      id: "@voyant-travel/distribution#subscriber.channel-push-content-changed",
      eventType: "product.content.changed",
      source: "@voyant-travel/distribution",
    },
  ],
  workflows: [
    {
      id: "channel.booking.push",
      config: { defaultRuntime: "node" },
      source: "@voyant-travel/distribution/channel-push-workflows",
    },
    {
      id: "channel.availability.push",
      config: { defaultRuntime: "node" },
      source: "@voyant-travel/distribution/channel-push-workflows",
    },
    {
      id: "channel.content.push",
      config: { defaultRuntime: "node" },
      source: "@voyant-travel/distribution/channel-push-workflows",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default distributionVoyantModule
