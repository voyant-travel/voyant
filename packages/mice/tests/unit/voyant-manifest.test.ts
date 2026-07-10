import { describe, expect, it } from "vitest"
import { miceBookingVoyantPlugin, miceVoyantModule } from "../../src/voyant.js"

describe("MICE deployment manifests", () => {
  it("owns the module runtime, persistence, and link facets", () => {
    expect(miceVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/mice",
      packageName: "@voyant-travel/mice",
      api: [
        {
          id: "@voyant-travel/mice#api.admin",
          surface: "admin",
          mount: "@voyant-travel/mice",
          transactional: true,
          runtime: { entry: "@voyant-travel/mice", export: "createMiceHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/mice#schema" }],
      migrations: [{ id: "@voyant-travel/mice#migrations" }],
      links: [
        { id: "@voyant-travel/mice#linkable.program" },
        { id: "@voyant-travel/mice#linkable.session" },
        { id: "@voyant-travel/mice#linkable.delegate" },
        { id: "@voyant-travel/mice#linkable.roomingAssignment" },
        { id: "@voyant-travel/mice#linkable.rfp" },
        { id: "@voyant-travel/mice#linkable.bid" },
      ],
    })
  })

  it("owns the booking extension", () => {
    expect(miceBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/mice#booking-extension",
      packageName: "@voyant-travel/mice",
      api: [
        {
          id: "@voyant-travel/mice#booking-extension.api.admin",
          mount: "@voyant-travel/mice/booking-extension",
          runtime: {
            entry: "@voyant-travel/mice/booking-extension",
            export: "miceBookingExtension",
          },
        },
      ],
    })
  })
})
