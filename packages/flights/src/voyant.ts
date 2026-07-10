import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the flights package. */
export const flightsVoyantModule = defineModule({
  id: "@voyant-travel/flights",
  packageName: "@voyant-travel/flights",
  localId: "flights",
  api: [
    {
      id: "@voyant-travel/flights#api",
      surface: "admin",
      mount: "flights",
      runtime: {
        entry: "@voyant-travel/flights/hono",
        export: "createFlightsHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/flights#schema",
      source: "@voyant-travel/flights/reference/local-postgres",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/flights#migrations",
      source: "./migrations",
    },
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default flightsVoyantModule
