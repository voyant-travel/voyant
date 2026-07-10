import { describe, expect, it } from "vitest"
import { createChartersHonoModule } from "../../src/index.js"
import { chartersBookingVoyantPlugin, chartersVoyantModule } from "../../src/voyant.js"

describe("charters deployment manifest", () => {
  it("owns its transactional operator and anonymous storefront surfaces", () => {
    expect(chartersVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/charters",
      packageName: "@voyant-travel/charters",
      api: [
        {
          surface: "admin",
          mount: "charters",
          transactional: true,
          runtime: { export: "createChartersHonoModule" },
        },
        {
          surface: "public",
          mount: "charters",
          anonymous: true,
          transactional: true,
          runtime: { export: "createChartersHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/charters#schema", source: "@voyant-travel/charters/schema" }],
      migrations: [{ id: "@voyant-travel/charters#migrations", source: "./migrations" }],
      links: [
        { id: "@voyant-travel/charters#linkable.charter_product" },
        { id: "@voyant-travel/charters#linkable.charter_voyage" },
        { id: "@voyant-travel/charters#linkable.charter_yacht" },
      ],
    })
  })

  it("owns the bookings extension and preserves injected lazy bridges", () => {
    expect(chartersBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/charters#booking-extension",
      api: [
        { surface: "admin", mount: "bookings", runtime: { export: "chartersBookingExtension" } },
      ],
    })

    const lazyAdminRoutes = async () => ({}) as never
    const lazyPublicRoutes = async () => ({}) as never
    const module = createChartersHonoModule({ lazyAdminRoutes, lazyPublicRoutes, anonymous: true })
    expect(module).toMatchObject({ lazyAdminRoutes, lazyPublicRoutes, anonymous: true })
    expect(module.adminRoutes).toBeUndefined()
    expect(module.publicRoutes).toBeUndefined()
  })
})
