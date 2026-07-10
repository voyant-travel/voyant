import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the identity package. */
export const identityVoyantModule = defineModule({
  id: "@voyant-travel/identity",
  packageName: "@voyant-travel/identity",
  localId: "identity",
  api: [
    {
      id: "@voyant-travel/identity#api.admin",
      surface: "admin",
      mount: "identity",
      runtime: {
        entry: "@voyant-travel/identity",
        export: "identityHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/identity#schema",
      source: "@voyant-travel/identity/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/identity#migrations",
      source: "./migrations",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default identityVoyantModule
