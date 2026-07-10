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
      schemaVersion: "voyant.extension.v1",
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

  it("declares the packaged booking routes, slots, and CRM contribution", () => {
    expect(bookingsVoyantModule.admin).toMatchObject({
      routes: [
        { id: "@voyant-travel/bookings#admin.route.index", path: "/bookings" },
        { id: "@voyant-travel/bookings#admin.route.detail", path: "/bookings/$id" },
        { id: "@voyant-travel/bookings#admin.route.new", path: "/bookings/new" },
        { id: "@voyant-travel/bookings#admin.route.compose", path: "/bookings/compose" },
        {
          id: "@voyant-travel/bookings#admin.route.journey",
          path: "/catalog/journey/$entityModule/$entityId",
        },
      ],
      slots: [
        { id: "booking.details.invoices-tab" },
        { id: "booking.details.finance-start" },
        { id: "booking.details.finance-end" },
      ],
      contributions: [
        {
          id: "@voyant-travel/bookings#admin.contribution.person-bookings",
          slotId: "person.details.bookings-tab",
        },
      ],
    })

    const runtimeReferences = [
      ...(bookingsVoyantModule.admin?.routes ?? []),
      ...(bookingsVoyantModule.admin?.contributions ?? []),
    ].map((facet) => facet.runtime)
    expect(new Set(runtimeReferences.map((runtime) => JSON.stringify(runtime)))).toEqual(
      new Set([
        JSON.stringify({
          entry: "@voyant-travel/bookings-react/admin",
          export: "createBookingsAdminExtension",
        }),
      ]),
    )
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
