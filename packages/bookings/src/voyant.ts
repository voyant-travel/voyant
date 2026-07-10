import { defineModule } from "@voyant-travel/core/project"

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
        export: "bookingsHonoModule",
      },
    },
    {
      id: "@voyant-travel/bookings#api.public",
      surface: "public",
      mount: "bookings",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/bookings",
        export: "bookingsHonoModule",
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
  meta: {
    ownership: "package",
  },
})

export default bookingsVoyantModule
