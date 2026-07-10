import { defineModule, definePlugin } from "@voyant-travel/core/project"

/**
 * Import-cheap deployment declaration owned by the bookings package.
 * Executable package surfaces stay behind symbolic package export references.
 */
export const bookingsVoyantModule = defineModule({
  id: "@voyant-travel/bookings",
  packageName: "@voyant-travel/bookings",
  localId: "bookings",
  api: [
    {
      id: "@voyant-travel/bookings#api.admin",
      surface: "admin",
      mount: "bookings",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/bookings",
        export: "createBookingsHonoModule",
      },
    },
    {
      id: "@voyant-travel/bookings#api.public",
      surface: "public",
      mount: "bookings",
      anonymous: true,
      transactional: true,
      runtime: {
        entry: "@voyant-travel/bookings",
        export: "createBookingsHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/bookings#schema",
      source: "@voyant-travel/bookings/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/bookings#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/bookings#linkable.booking",
      source: "@voyant-travel/bookings/linkables",
    },
  ],
  workflows: [
    {
      id: "bookings.expire-stale-holds",
      config: {
        defaultRuntime: "node",
        schedule: {
          cron: "*/5 * * * *",
          name: "every-5-minutes",
        },
      },
      source: "@voyant-travel/bookings/workflows",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const bookingRequirementsVoyantModule = defineModule({
  id: "@voyant-travel/bookings#requirements",
  packageName: "@voyant-travel/bookings",
  localId: "bookings.requirements",
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
  meta: {
    ownership: "package",
  },
})

export const bookingsSupplierVoyantPlugin = definePlugin({
  id: "@voyant-travel/bookings#booking-supplier-extension",
  packageName: "@voyant-travel/bookings",
  localId: "bookings.booking-supplier-extension",
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
  meta: {
    ownership: "package",
  },
})

export default bookingsVoyantModule
