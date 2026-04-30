/**
 * Shared catalog-plane runtime helpers.
 *
 * Centralizes the env-driven construction of the Typesense indexer + the
 * default slice set so both the per-request MCP route handler and the
 * background catalog-bridge subscribers stay aligned.
 */

import { productCatalogPolicy } from "@voyantjs/products/catalog-policy"
import {
  createFieldPolicyRegistry,
  createTypesenseIndexer,
  type FieldPolicyRegistry,
  type IndexerAdapter,
  type IndexerSlice,
  type TypesenseClient,
} from "@voyantjs/voyant-catalog"
import { Client as TypesenseSdkClient } from "typesense"

/**
 * The slice set the operator template indexes by default — staff (admin
 * search) + customer (storefront browse) on en-GB and the `default` market.
 * Kept in one place so the bulk-reindex CLI, the live-reindex bridge, and
 * the MCP routes never drift on which collections exist.
 */
export const DEFAULT_SLICES: ReadonlyArray<IndexerSlice> = [
  { vertical: "products", locale: "en-GB", audience: "staff", market: "default" },
  { vertical: "products", locale: "en-GB", audience: "customer", market: "default" },
]

/**
 * Just the env keys this module reads. Callers may pass any superset
 * (e.g. the full `CloudflareBindings`); structural assignment ignores
 * extra properties.
 */
export type CatalogRuntimeEnv = {
  TYPESENSE_HOST?: string
  TYPESENSE_ADMIN_API_KEY?: string
  TYPESENSE_API_KEY?: string
}

/**
 * Construct the Typesense `IndexerAdapter` from env, or return `undefined`
 * when Typesense isn't configured. Mirrors the same env-name fallbacks as
 * the bulk reindex CLI.
 */
export function buildTypesenseIndexer(env: CatalogRuntimeEnv): IndexerAdapter | undefined {
  const host = env.TYPESENSE_HOST
  const apiKey = env.TYPESENSE_ADMIN_API_KEY ?? env.TYPESENSE_API_KEY
  if (!host || !apiKey) return undefined

  let parsed: URL
  try {
    parsed = new URL(host)
  } catch {
    return undefined
  }

  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80
  const protocol = parsed.protocol.replace(":", "") as "http" | "https"

  const client = new TypesenseSdkClient({
    nodes: [{ host: parsed.hostname, port, protocol }],
    apiKey,
    connectionTimeoutSeconds: 10,
  })

  return createTypesenseIndexer({ client: client as unknown as TypesenseClient })
}

/**
 * Singleton-per-process registry map. Built lazily; safe across requests
 * because field policies are static.
 */
let _registries: Map<string, FieldPolicyRegistry> | undefined
export function getFieldPolicyRegistries(): Map<string, FieldPolicyRegistry> {
  if (!_registries) {
    _registries = new Map<string, FieldPolicyRegistry>([
      ["products", createFieldPolicyRegistry(productCatalogPolicy)],
    ])
  }
  return _registries
}
