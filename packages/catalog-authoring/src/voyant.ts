import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the catalog-authoring package. */
export const catalogAuthoringVoyantModule = defineModule({
  id: "@voyant-travel/catalog-authoring",
  packageName: "@voyant-travel/catalog-authoring",
  localId: "catalog-authoring",
  schema: [
    {
      id: "@voyant-travel/catalog-authoring#schema",
      source: "@voyant-travel/catalog-authoring/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/catalog-authoring#migrations",
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

export default catalogAuthoringVoyantModule
