import type { IndexerProvider } from "@voyant-travel/catalog-contracts/indexer/contract"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import { createPostgresIndexer } from "./postgres.js"

const DATABASE_RESOURCE_ID = "@voyant-travel/catalog#resource.database"

interface PostgresGraphProviderContext {
  getResource: <T = unknown>(declarationId: string) => T | undefined
}

/**
 * First-party catalog search provider backed by the deployment's primary
 * Postgres resource. The graph resource boundary is deliberate: this provider
 * must use the resident application pool, never open an untracked pool from a
 * connection string of its own.
 */
export function createPostgresGraphIndexerProvider(
  context: PostgresGraphProviderContext,
): IndexerProvider {
  const db = context.getResource<AnyDrizzleDb>(DATABASE_RESOURCE_ID)
  if (!db) {
    throw new Error(
      `Postgres catalog indexer requires database resource "${DATABASE_RESOURCE_ID}".`,
    )
  }

  return {
    create: ({ registries, vectorDimensions }) =>
      createPostgresIndexer({ db, registries, vectorDimensions }),
  }
}
