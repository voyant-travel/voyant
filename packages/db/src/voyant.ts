import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the database package. */
export const dbVoyantModule = defineModule({
  id: "@voyant-travel/db",
  packageName: "@voyant-travel/db",
  localId: "db",
  provides: {
    ports: [{ id: "database.client" }],
  },
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
  config: [
    {
      id: "@voyant-travel/db#config.adapter",
      key: "DB_ADAPTER",
    },
  ],
  secrets: [
    {
      id: "@voyant-travel/db#secret.database-url",
      key: "DATABASE_URL",
      required: true,
      description: "Primary Postgres connection URL for the Node application.",
      rotation: "replace-only",
    },
  ],
  resources: [
    {
      id: "@voyant-travel/db#resource.database",
      kind: "database",
      required: true,
      config: { engine: "postgres" },
    },
  ],
  providers: [
    {
      id: "@voyant-travel/db#provider.postgres-node",
      port: "database.client",
      runtime: {
        entry: "@voyant-travel/db/runtime",
        export: "createDbClient",
      },
      config: { adapter: "node" },
    },
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default dbVoyantModule
