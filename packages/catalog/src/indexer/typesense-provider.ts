import type { IndexerProvider } from "@voyant-travel/catalog-contracts/indexer/contract"
import { createTypesenseIndexer } from "./typesense.js"
import { createTypesenseFetchClient } from "./typesense-fetch-client.js"

const TYPESENSE_HOST_CONFIG_ID = "@voyant-travel/catalog#config.typesense-host"
const TYPESENSE_API_KEY_SECRET_ID = "@voyant-travel/catalog#secret.typesense-api-key"
const TYPESENSE_COLLECTION_PREFIX_CONFIG_ID =
  "@voyant-travel/catalog#config.typesense-collection-prefix"

interface TypesenseGraphProviderContext {
  getConfig: <T = unknown>(declarationId: string) => T | undefined
  getSecret: <T = unknown>(declarationId: string) => T | undefined
}

/** First-party Typesense implementation selected by deployment.providers.search. */
export function createTypesenseGraphIndexerProvider(
  context: TypesenseGraphProviderContext,
): IndexerProvider {
  const host = requiredString(context.getConfig(TYPESENSE_HOST_CONFIG_ID), "TYPESENSE_HOST")
  const apiKey = requiredString(context.getSecret(TYPESENSE_API_KEY_SECRET_ID), "TYPESENSE_API_KEY")
  // Optional: multi-tenant single-cluster deployments (e.g. a managed fleet
  // sharing one Typesense cluster) namespace every collection and scope each
  // tenant's API key to `<prefix>__.*`.
  const collectionPrefix = optionalString(context.getConfig(TYPESENSE_COLLECTION_PREFIX_CONFIG_ID))
  const url = new URL(host)

  return {
    create: ({ registries, vectorDimensions }) =>
      createTypesenseIndexer({
        client: createTypesenseFetchClient(url.toString(), apiKey),
        registries,
        vectorDimensions,
        ...(collectionPrefix ? { collectionPrefix } : {}),
      }),
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`)
  }
  return value.trim()
}
