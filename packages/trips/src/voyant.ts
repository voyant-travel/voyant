import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the trips package. */
export const tripsVoyantModule = defineModule({
  id: "@voyant-travel/trips",
  packageName: "@voyant-travel/trips",
  localId: "trips",
  api: [
    {
      id: "@voyant-travel/trips#api.admin",
      surface: "admin",
      mount: "trips",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/trips",
        export: "createTripsHonoModule",
      },
    },
    {
      id: "@voyant-travel/trips#api.public",
      surface: "public",
      mount: "trips",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/trips",
        export: "createTripsHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/trips#schema",
      source: "@voyant-travel/trips/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/trips#migrations",
      source: "./migrations",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default tripsVoyantModule
