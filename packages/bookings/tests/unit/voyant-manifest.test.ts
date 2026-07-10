import { describe, expect, it } from "vitest"
import { bookingsVoyantModule } from "../../src/voyant.js"

describe("bookings deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(bookingsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/bookings",
      packageName: "@voyant-travel/bookings",
      api: [
        {
          id: "@voyant-travel/bookings#api.admin",
          surface: "admin",
          runtime: { entry: "@voyant-travel/bookings", export: "bookingsHonoModule" },
        },
        {
          id: "@voyant-travel/bookings#api.public",
          surface: "public",
          runtime: { entry: "@voyant-travel/bookings", export: "bookingsHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/bookings#schema" }],
      migrations: [{ id: "@voyant-travel/bookings#migrations" }],
      links: [{ id: "@voyant-travel/bookings#linkable.booking" }],
    })
  })
})
