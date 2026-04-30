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
  type DocumentBuilder,
  type FieldPolicyRegistry,
  type IndexerAdapter,
  type IndexerDocument,
  type IndexerSlice,
  type TypesenseClient,
} from "@voyantjs/voyant-catalog"
import { createGeminiEmbeddingProvider, type EmbeddingProvider } from "@voyantjs/voyant-catalog-rag"
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
  VOYANT_CLOUD_API_KEY?: string
  VOYANT_CLOUD_API_URL?: string
}

/**
 * Construct the embedding provider from env, or return `undefined` when no
 * Voyant Cloud key is configured. Used both for query-time embedding
 * (semantic search) and write-time embedding (attaching `text_embedding`
 * to indexer docs).
 *
 * Default: Gemini via the Voyant Cloud AI gateway (`/ai/v1/gemini`). The
 * gateway forwards to Google's embeddings API with the org's saved
 * provider key, so the template only needs the Voyant Cloud token. Usage
 * tracking + token-level rate limits are handled by the gateway.
 *
 * Swap by editing this function:
 *  - Direct Google: pass `auth: "google"` + the raw Gemini key.
 *  - OpenAI: import `createOpenAIEmbeddingProvider` and read
 *    `OPENAI_API_KEY` instead.
 *  - Custom provider: return anything matching `EmbeddingProvider`
 *    from `@voyantjs/voyant-catalog-rag`.
 *
 * Switching providers (or models) is a deliberate `bulkReindex` operation —
 * the catalog plane scopes vector queries to documents matching the active
 * `embedding_model_id`, so mid-migration mixes are handled cleanly.
 */
export function buildEmbeddingProvider(env: CatalogRuntimeEnv): EmbeddingProvider | undefined {
  if (!env.VOYANT_CLOUD_API_KEY) return undefined
  const cloudBase = (env.VOYANT_CLOUD_API_URL ?? "https://api.voyantjs.com").replace(/\/$/, "")
  return createGeminiEmbeddingProvider({
    apiKey: env.VOYANT_CLOUD_API_KEY,
    auth: "bearer",
    baseUrl: `${cloudBase}/ai/v1/gemini`,
  })
}

/**
 * Construct the Typesense `IndexerAdapter` from env, or return `undefined`
 * when Typesense isn't configured. When an `EmbeddingProvider` is supplied,
 * the indexer's collection schema declares a `text_embedding` vector field
 * sized to the provider's dimensions, unlocking semantic + hybrid search.
 */
export function buildTypesenseIndexer(
  env: CatalogRuntimeEnv,
  embeddings?: EmbeddingProvider,
): IndexerAdapter | undefined {
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

  return createTypesenseIndexer({
    client: client as unknown as TypesenseClient,
    vectorDimensions: embeddings?.capabilities.dimensions,
  })
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

/**
 * Wraps a `DocumentBuilder` so that every emitted document carries a
 * `text_embedding` vector computed from the document's merchandisable
 * fields. No-op if `embeddings` is undefined — the inner builder runs
 * unchanged. Embedding errors are caught and logged so a transient OpenAI
 * outage doesn't poison the reindex pipeline.
 */
export function withEmbedding(
  inner: DocumentBuilder,
  embeddings: EmbeddingProvider | undefined,
): DocumentBuilder {
  if (!embeddings) return inner
  return async (entityId, slice): Promise<IndexerDocument | null> => {
    const doc = await inner(entityId, slice)
    if (!doc) return null
    const text = composeMerchandisableText(doc)
    if (!text) return doc
    try {
      const [vector] = await embeddings.embed([text])
      if (!vector) return doc
      return {
        ...doc,
        embeddings: { ...(doc.embeddings ?? {}), text_embedding: vector },
        embedding_model_id: embeddings.capabilities.modelId,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[catalog] embedding failed for ${slice.vertical}/${entityId}: ${message}`)
      return doc
    }
  }
}

function composeMerchandisableText(doc: IndexerDocument): string {
  // Concatenate the well-known merchandisable fields that ship with the
  // products policy. Order matters: name first (highest signal), then
  // description, then tags. Other verticals copy this when they adopt.
  const parts: string[] = []
  const name = doc.fields.name
  if (typeof name === "string" && name.length > 0) parts.push(name)
  const description = doc.fields.description
  if (typeof description === "string" && description.length > 0) parts.push(description)
  const tags = doc.fields.tags
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag === "string" && tag.length > 0) parts.push(tag)
    }
  }
  return parts.join(" ")
}
