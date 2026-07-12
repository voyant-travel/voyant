import { describe, expect, it } from "vitest"
import { createBookingsVoyantRuntime } from "../../src/index.js"
import { createBookingRequirementsVoyantRuntime } from "../../src/requirements/index.js"
import {
  bookingRequirementsVoyantModule,
  bookingsSupplierVoyantPlugin,
  bookingsVoyantModule,
} from "../../src/voyant.js"
import {
  bookingsExpireStaleHoldsWorkflow,
  createBookingsExpireStaleHoldsWorkflow,
} from "../../src/workflow-entry.js"

describe("bookings deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(bookingsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/bookings",
      packageName: "@voyant-travel/bookings",
      runtime: { entry: "@voyant-travel/bookings", export: "createBookingsVoyantRuntime" },
      runtimePorts: [{ id: "bookings.runtime" }],
      api: [
        {
          id: "@voyant-travel/bookings#api.admin",
          surface: "admin",
          openapi: { document: "bookings" },
          resource: "bookings",
          runtime: { entry: "@voyant-travel/bookings", export: "createBookingsHonoModule" },
        },
        {
          id: "@voyant-travel/bookings#api.public",
          surface: "public",
          openapi: { document: "bookings" },
          resource: "bookings",
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
          runtime: {
            entry: "@voyant-travel/bookings/workflows",
            export: "bookingsExpireStaleHoldsWorkflow",
          },
        },
      ],
    })

    expect(bookingsExpireStaleHoldsWorkflow.id).toBe(bookingsVoyantModule.workflows[0]?.id)
  })

  it("owns the selected Bookings access catalog", () => {
    expect(bookingsVoyantModule.access?.resources).toEqual([
      expect.objectContaining({
        resource: "bookings",
        actions: [
          expect.objectContaining({ action: "read" }),
          expect.objectContaining({ action: "write" }),
        ],
        legacyActions: ["cancel"],
      }),
      expect.objectContaining({
        resource: "bookings-pii",
        wildcard: "explicit-resource",
        actions: [expect.objectContaining({ action: "read" })],
      }),
    ])
    expect(bookingsVoyantModule.admin?.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "@voyant-travel/bookings#admin.route.index",
          requiredScopes: ["bookings:read"],
        }),
        expect.objectContaining({
          id: "@voyant-travel/bookings#admin.route.new",
          requiredScopes: ["bookings:write"],
        }),
      ]),
    )
    expect(bookingsVoyantModule.admin?.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "@voyant-travel/bookings#admin.contribution.person-bookings",
          requiredScopes: ["bookings:read"],
        }),
      ]),
    )
  })

  it("owns the requirements module and supplier extension", () => {
    expect(bookingRequirementsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/bookings#requirements",
      packageName: "@voyant-travel/bookings",
      runtime: {
        entry: "@voyant-travel/bookings/requirements",
        export: "createBookingRequirementsVoyantRuntime",
      },
      runtimePorts: [{ id: "bookings.requirements.runtime" }],
      api: [
        {
          id: "@voyant-travel/bookings#requirements.api",
          surface: "admin",
          mount: "booking-requirements",
          openapi: { document: "booking-requirements" },
          runtime: {
            entry: "@voyant-travel/bookings/requirements",
            export: "createBookingRequirementsHonoModule",
          },
        },
        {
          id: "@voyant-travel/bookings#requirements.api.public",
          surface: "public",
          mount: "booking-requirements",
          openapi: { document: "booking-requirements" },
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
          openapi: { document: "bookings" },
          runtime: {
            entry: "@voyant-travel/bookings/extensions/suppliers",
            export: "bookingsSupplierExtension",
          },
        },
      ],
    })
  })

  it("mounts only selected Bookings API surfaces", async () => {
    const context = {
      unitId: "@voyant-travel/bookings",
      projectConfig: {},
      api: [{ id: "bookings.public", surface: "public" as const }],
      hasPort: () => true,
      getPort: async <TProvider>() => ({ options: {} }) as unknown as TProvider,
    }
    const bookings = await createBookingsVoyantRuntime(context)
    const requirements = await createBookingRequirementsVoyantRuntime({
      ...context,
      unitId: "@voyant-travel/bookings#requirements",
      getPort: async <TProvider>() => ({}) as TProvider,
    })

    expect(bookings.adminRoutes).toBeUndefined()
    expect(bookings.publicRoutes).toBeDefined()
    expect(requirements.adminRoutes).toBeUndefined()
    expect(requirements.publicRoutes).toBeDefined()
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
        { id: "bookings.list.header-actions" },
        { id: "booking.details.payment-controller" },
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
