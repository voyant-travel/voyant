import { describe, expect, it } from "vitest"
import {
  createChannelPushExtension,
  distributionBookingExtension,
  distributionHonoModule,
  externalRefsHonoModule,
  suppliersHonoModule,
} from "../../src/index.js"
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
      schema: [{ id: "@voyant-travel/distribution#schema" }],
      migrations: [{ id: "@voyant-travel/distribution#migrations" }],
      links: [{ id: "@voyant-travel/distribution#linkable.supplier" }],
    })
  })

  it("owns the booking and channel-push extensions", () => {
    expect(distributionBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/distribution#extension",
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
    })

    expect(distributionChannelPushVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/distribution#channel-push-extension",
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
    })
  })

  it("references exported runtimes with matching mounts", () => {
    expect(externalRefsHonoModule.module.name).toBe("external-refs")
    expect(distributionHonoModule.module.name).toBe("distribution")
    expect(suppliersHonoModule.module.name).toBe("suppliers")
    expect(distributionBookingExtension.extension.module).toBe("bookings")
    expect(createChannelPushExtension).toBeTypeOf("function")
  })
})
