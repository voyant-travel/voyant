import { createDbClient, type DbAdapter } from "../index.js"

const DATABASE_URL_SECRET = "@voyant-travel/db#secret.database-url"

interface GraphDbProviderContext {
  providerConfig: Readonly<Record<string, unknown>>
  getSecret: <T = unknown>(declarationId: string) => T | undefined
}

/** Graph factory for the Node Postgres implementation of `database.client`. */
export function createGraphDbProvider(context: GraphDbProviderContext) {
  const connectionString = context.getSecret<string>(DATABASE_URL_SECRET)
  if (!connectionString) {
    throw new Error(`Graph database provider requires secret declaration "${DATABASE_URL_SECRET}".`)
  }
  const adapter = context.providerConfig.adapter
  if (adapter !== "node") {
    throw new Error(`Graph database provider requires providerConfig.adapter "node".`)
  }
  return createDbClient(connectionString, { adapter: adapter as DbAdapter })
}
