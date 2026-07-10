import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the availability package. */
export const availabilityVoyantModule = defineModule({
  id: "@voyant-travel/availability",
  packageName: "@voyant-travel/availability",
  localId: "availability",
  schema: [
    {
      id: "@voyant-travel/availability#schema",
      source: "@voyant-travel/availability/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/availability#migrations",
      source: "./migrations",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default availabilityVoyantModule
