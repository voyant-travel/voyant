import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the charters package. */
export const chartersVoyantModule = defineModule({
  id: "@voyant-travel/charters",
  packageName: "@voyant-travel/charters",
  localId: "charters",
  schema: [
    {
      id: "@voyant-travel/charters#schema",
      source: "@voyant-travel/charters/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/charters#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/charters#linkable.charter_product",
      source: "@voyant-travel/charters",
    },
    {
      id: "@voyant-travel/charters#linkable.charter_voyage",
      source: "@voyant-travel/charters",
    },
    {
      id: "@voyant-travel/charters#linkable.charter_yacht",
      source: "@voyant-travel/charters",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default chartersVoyantModule
