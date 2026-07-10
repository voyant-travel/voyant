import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the database package. */
export const dbVoyantModule = defineModule({
  id: "@voyant-travel/db",
  packageName: "@voyant-travel/db",
  localId: "db",
  schema: [
    {
      id: "@voyant-travel/db#schema",
      source: "@voyant-travel/db/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/db#migrations",
      source: "./migrations",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default dbVoyantModule
