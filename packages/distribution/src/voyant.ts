import { defineModule, definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declarations owned by the distribution package. */
export const distributionVoyantModule = defineModule({
  id: "@voyant-travel/distribution",
  packageName: "@voyant-travel/distribution",
  localId: "distribution",
  api: [
    {
      id: "@voyant-travel/distribution#api",
      surface: "admin",
      mount: "@voyant-travel/distribution",
      runtime: {
        entry: "@voyant-travel/distribution",
        export: "distributionHonoModules",
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
      mount: "@voyant-travel/distribution",
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
      mount: "@voyant-travel/distribution/channel-push-extension",
      runtime: {
        entry: "@voyant-travel/distribution",
        export: "createChannelPushExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default distributionVoyantModule
