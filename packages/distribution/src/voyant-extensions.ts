import { defineExtension, requirePort } from "@voyant-travel/core/project"

import { channelPushRuntimePort } from "./channel-push/runtime-port.js"

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
  meta: { ownership: "package" },
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
  meta: { ownership: "package" },
})
