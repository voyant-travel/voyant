import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the catalog package. */
export const catalogVoyantModule = defineModule({
  id: "@voyant-travel/catalog",
  packageName: "@voyant-travel/catalog",
  localId: "catalog",
  api: [
    {
      id: "@voyant-travel/catalog#api.admin",
      surface: "admin",
      mount: "catalog",
      runtime: {
        entry: "@voyant-travel/catalog",
        export: "createCatalogSearchHonoModule",
      },
    },
    {
      id: "@voyant-travel/catalog#api.public",
      surface: "public",
      mount: "catalog",
      anonymous: true,
      runtime: {
        entry: "@voyant-travel/catalog",
        export: "createCatalogSearchHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/catalog#schema",
      source: "@voyant-travel/catalog/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/catalog#migrations",
      source: "./migrations",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default catalogVoyantModule
