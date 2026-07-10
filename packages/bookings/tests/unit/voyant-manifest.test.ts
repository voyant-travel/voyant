import { describe, expect, it } from "vitest"
import {
  bookingRequirementsVoyantModule,
  bookingsSupplierVoyantPlugin,
  bookingsVoyantModule,
} from "../../src/voyant.js"
import { createBookingsExpireStaleHoldsWorkflow } from "../../src/workflow-entry.js"

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
          runtime: { entry: "@voyant-travel/bookings", export: "createBookingsHonoModule" },
        },
        {
          id: "@voyant-travel/bookings#api.public",
          surface: "public",
          anonymous: true,
          runtime: { entry: "@voyant-travel/bookings", export: "createBookingsHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/bookings#schema" }],
      migrations: [{ id: "@voyant-travel/bookings#migrations" }],
      links: [{ id: "@voyant-travel/bookings#linkable.booking" }],
      workflows: [
        {
          id: "bookings.expire-stale-holds",
          source: "@voyant-travel/bookings/workflows",
          config: {
            schedule: { cron: "*/5 * * * *", name: "every-5-minutes" },
          },
        },
      ],
    })
  })

  it("owns the requirements module and supplier extension", () => {
    expect(bookingRequirementsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/bookings#requirements",
      packageName: "@voyant-travel/bookings",
      api: [
        {
          id: "@voyant-travel/bookings#requirements.api",
          surface: "admin",
          mount: "booking-requirements",
          runtime: {
            entry: "@voyant-travel/bookings/requirements",
            export: "createBookingRequirementsHonoModule",
          },
        },
        {
          id: "@voyant-travel/bookings#requirements.api.public",
          surface: "public",
          mount: "booking-requirements",
          runtime: {
            entry: "@voyant-travel/bookings/requirements",
            export: "createBookingRequirementsHonoModule",
          },
        },
      ],
    })

    expect(bookingsSupplierVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/bookings#booking-supplier-extension",
      packageName: "@voyant-travel/bookings",
      api: [
        {
          id: "@voyant-travel/bookings#booking-supplier-extension.api",
          surface: "admin",
          mount: "bookings",
          runtime: {
            entry: "@voyant-travel/bookings/extensions/suppliers",
            export: "bookingsSupplierExtension",
          },
        },
      ],
    })
  })

  it("exposes the scheduled stale-hold workflow factory", () => {
    const definition = createBookingsExpireStaleHoldsWorkflow({
      resolveDb: () => ({}) as never,
    })
    expect(definition.id).toBe("bookings.expire-stale-holds")
    expect(definition.config.schedule).toEqual({
      cron: "*/5 * * * *",
      name: "every-5-minutes",
    })
  })
})
