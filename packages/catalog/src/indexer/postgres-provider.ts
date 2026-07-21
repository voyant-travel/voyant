import type { IndexerProvider } from "@voyant-travel/catalog-contracts/indexer/contract"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import { createPostgresIndexer } from "./postgres.js"

const DATABASE_RESOURCE_ID = "@voyant-travel/catalog#resource.database"
const VECTOR_STRATEGY_CONFIG_ID = "@voyant-travel/catalog#config.postgres-search-vector-strategy"
const TYPO_STRATEGY_CONFIG_ID = "@voyant-travel/catalog#config.postgres-search-typo-strategy"
const TEXT_STRATEGY_CONFIG_ID = "@voyant-travel/catalog#config.postgres-search-text-strategy"
const CURSOR_SIGNING_KEY_SECRET_ID =
  "@voyant-travel/catalog#secret.postgres-search-cursor-signing-key"

interface PostgresGraphProviderContext {
  getResource: <T = unknown>(declarationId: string) => T | undefined
  getConfig: <T = unknown>(declarationId: string) => T | undefined
  getSecret: <T = unknown>(declarationId: string) => T | undefined
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
  const vectorStrategy = resolveVectorStrategy(context.getConfig(VECTOR_STRATEGY_CONFIG_ID))
  const typoStrategy = resolveTypoStrategy(context.getConfig(TYPO_STRATEGY_CONFIG_ID))
  const textStrategy = resolveTextStrategy(context.getConfig(TEXT_STRATEGY_CONFIG_ID))
  const cursorSigningKey = requiredString(
    context.getSecret(CURSOR_SIGNING_KEY_SECRET_ID),
    "POSTGRES_SEARCH_CURSOR_SIGNING_KEY",
  )

  return {
    create: ({ registries, vectorDimensions }) =>
      createPostgresIndexer({
        db,
        registries,
        vectorDimensions,
        vectorStrategy,
        typoStrategy,
        textStrategy,
        cursorSigningKey,
      }),
  }
}

function resolveTextStrategy(value: unknown): "native" | "lakebase" {
  if (value === undefined || value === "" || value === "native") return "native"
  if (value === "lakebase") return value
  throw new Error('POSTGRES_SEARCH_TEXT_STRATEGY must be either "native" or "lakebase".')
}

function resolveTypoStrategy(value: unknown): "none" | "pgtrgm" {
  if (value === undefined || value === "" || value === "none") return "none"
  if (value === "pgtrgm") return value
  throw new Error('POSTGRES_SEARCH_TYPO_STRATEGY must be either "none" or "pgtrgm".')
}

function resolveVectorStrategy(value: unknown): "none" | "pgvector" | "lakebase" {
  if (value === undefined || value === "" || value === "none") return "none"
  if (value === "pgvector" || value === "lakebase") return value
  throw new Error('POSTGRES_SEARCH_VECTOR_STRATEGY must be "none", "pgvector", or "lakebase".')
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`)
  }
  return value.trim()
}
