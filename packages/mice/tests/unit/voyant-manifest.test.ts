import { describe, expect, it } from "vitest"
import { miceBookingExtension } from "../../src/booking-extension.js"
import { createMiceHonoModule } from "../../src/index.js"
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
          mount: "mice",
          transactional: true,
          runtime: { entry: "@voyant-travel/mice", export: "createMiceVoyantRuntime" },
        },
      ],
      schema: [{ id: "@voyant-travel/mice#schema" }],
      migrations: [{ id: "@voyant-travel/mice#migrations" }],
      admin: {
        runtime: {
          entry: "@voyant-travel/mice-react/admin",
          export: "createSelectedMiceAdminExtension",
        },
        routes: [
          {
            id: "@voyant-travel/mice#admin.route.programs-index",
            path: "/mice",
          },
          {
            id: "@voyant-travel/mice#admin.route.programs-detail",
            path: "/mice/$id",
          },
        ],
      },
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
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/mice#booking-extension",
      packageName: "@voyant-travel/mice",
      api: [
        {
          id: "@voyant-travel/mice#booking-extension.api.admin",
          surface: "admin",
          mount: "bookings",
          runtime: {
            entry: "@voyant-travel/mice/booking-extension",
            export: "miceBookingExtension",
          },
        },
      ],
    })
  })

  it("references exported runtimes with matching mounts", () => {
    expect(createMiceHonoModule().module.name).toBe("mice")
    expect(miceBookingExtension.extension.module).toBe("bookings")
  })
})
