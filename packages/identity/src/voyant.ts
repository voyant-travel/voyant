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
      openapi: { document: "identity" },
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
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default identityVoyantModule
