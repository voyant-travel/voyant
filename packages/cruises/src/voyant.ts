import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the cruises package. */
export const cruisesVoyantModule = defineModule({
  id: "@voyant-travel/cruises",
  packageName: "@voyant-travel/cruises",
  localId: "cruises",
  schema: [
    {
      id: "@voyant-travel/cruises#schema",
      source: "@voyant-travel/cruises/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/cruises#migrations",
      source: "./migrations",
    },
  ],
  links: [
    { id: "@voyant-travel/cruises#linkable.cruise", source: "@voyant-travel/cruises" },
    {
      id: "@voyant-travel/cruises#linkable.cruise_voyage_group",
      source: "@voyant-travel/cruises",
    },
    {
      id: "@voyant-travel/cruises#linkable.cruise_sailing",
      source: "@voyant-travel/cruises",
    },
    { id: "@voyant-travel/cruises#linkable.cruise_ship", source: "@voyant-travel/cruises" },
  ],
  meta: {
    ownership: "package",
  },
})

export default cruisesVoyantModule
