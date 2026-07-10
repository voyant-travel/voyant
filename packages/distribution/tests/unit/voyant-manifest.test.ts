import { describe, expect, it } from "vitest"
import {
  distributionBookingVoyantPlugin,
  distributionChannelPushVoyantPlugin,
  distributionVoyantModule,
} from "../../src/voyant.js"

describe("distribution deployment manifests", () => {
  it("owns the module runtime and persistence facets", () => {
    expect(distributionVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/distribution",
      packageName: "@voyant-travel/distribution",
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
      schema: [{ id: "@voyant-travel/distribution#schema" }],
      migrations: [{ id: "@voyant-travel/distribution#migrations" }],
      links: [{ id: "@voyant-travel/distribution#linkable.supplier" }],
    })
  })

  it("owns the booking and channel-push extensions", () => {
    expect(distributionBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/distribution#extension",
      localId: "distribution",
      api: [
        {
          id: "@voyant-travel/distribution#extension.api",
          mount: "@voyant-travel/distribution",
          runtime: {
            entry: "@voyant-travel/distribution",
            export: "distributionBookingExtension",
          },
        },
      ],
    })

    expect(distributionChannelPushVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/distribution#channel-push-extension",
      localId: "distribution.channel-push-extension",
      api: [
        {
          id: "@voyant-travel/distribution#channel-push-extension.api",
          mount: "@voyant-travel/distribution/channel-push-extension",
          runtime: {
            entry: "@voyant-travel/distribution",
            export: "createChannelPushExtension",
          },
        },
      ],
    })
  })
})
