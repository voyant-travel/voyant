/**
 * Bulk reindex CLI — populates the configured Typesense indexer with documents
 * from each adopted vertical, fanning out across the configured slices.
 *
 * Usage (from templates/operator):
 *   pnpm exec tsx scripts/reindex.ts                  # reindex all verticals
 *   pnpm exec tsx scripts/reindex.ts products         # one vertical only
 *
 * Env required:
 *   DATABASE_URL              — Postgres connection string
 *   TYPESENSE_HOST            — e.g. http://localhost:8108
 *   TYPESENSE_ADMIN_API_KEY   — admin key
 *
 * Env optional:
 *   VOYANT_CLOUD_API_KEY      — when set, every emitted document gets a
 *                               `text_embedding` vector via the Voyant
 *                               Cloud Gemini gateway. Without it, the
 *                               index works for keyword search only. Swap
 *                               to direct Google or OpenAI by editing the
 *                               `embeddings` factory below.
 *   VOYANT_CLOUD_API_URL      — defaults to `https://api.voyantjs.com`.
 *                               Override for staging gateways.
 */

import {
  createFieldPolicyRegistry,
  createIndexerService,
  createTypesenseIndexer,
  type DocumentBuilder,
  type FieldPolicyRegistry,
  type IndexerDocument,
  type IndexerSlice,
  type TypesenseClient,
} from "@voyantjs/catalog"
import { createGeminiEmbeddingProvider, type EmbeddingProvider } from "@voyantjs/catalog-rag"
import { createDbClient } from "@voyantjs/db"
import { productCatalogPolicy } from "@voyantjs/products/catalog-policy"
import { products } from "@voyantjs/products/schema"
import { createProductDocumentBuilder } from "@voyantjs/products/service-catalog-plane"
import { config } from "dotenv"
import { Client as TypesenseSdkClient } from "typesense"

config({ path: ".env" })
config({ path: "../../.env" })
config({ path: "../../.env.local" })
config({ path: ".dev.vars", override: true })

const databaseUrl = process.env.DATABASE_URL
const typesenseHost = process.env.TYPESENSE_HOST
const typesenseKey = process.env.TYPESENSE_ADMIN_API_KEY ?? process.env.TYPESENSE_API_KEY
const cloudApiKey = process.env.VOYANT_CLOUD_API_KEY
const cloudApiUrl = (process.env.VOYANT_CLOUD_API_URL ?? "https://api.voyantjs.com").replace(
  /\/$/,
  "",
)

if (!databaseUrl) throw new Error("DATABASE_URL is not set")
if (!typesenseHost) throw new Error("TYPESENSE_HOST is not set")
if (!typesenseKey) throw new Error("TYPESENSE_ADMIN_API_KEY is not set")

const sellerOperatorId = process.env.TENANT_ID ?? "default"

// Default slice set — staff (admin) + customer (storefront) on en-GB / default
// market. Add more locales / audiences here as the deployment needs them.
const SLICES: IndexerSlice[] = [
  { vertical: "products", locale: "en-GB", audience: "staff", market: "default" },
  { vertical: "products", locale: "en-GB", audience: "customer", market: "default" },
]

const requestedVertical = process.argv[2]

const db = createDbClient(databaseUrl, { adapter: "node" })

const embeddings: EmbeddingProvider | undefined = cloudApiKey
  ? createGeminiEmbeddingProvider({
      apiKey: cloudApiKey,
      auth: "bearer",
      baseUrl: `${cloudApiUrl}/ai/v1/gemini`,
    })
  : undefined

if (embeddings) {
  console.info(
    `[reindex] embeddings enabled via Voyant Cloud — model=${embeddings.capabilities.modelId} dims=${embeddings.capabilities.dimensions}`,
  )
} else {
  console.info("[reindex] embeddings disabled (VOYANT_CLOUD_API_KEY not set) — keyword-only index")
}

const parsed = new URL(typesenseHost)
const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80
const protocol = parsed.protocol.replace(":", "") as "http" | "https"
const tsClient = new TypesenseSdkClient({
  nodes: [{ host: parsed.hostname, port, protocol }],
  apiKey: typesenseKey,
  connectionTimeoutSeconds: 10,
})
const indexer = createTypesenseIndexer({
  client: tsClient as unknown as TypesenseClient,
  vectorDimensions: embeddings?.capabilities.dimensions,
})

const registries = new Map<string, FieldPolicyRegistry>([
  ["products", createFieldPolicyRegistry(productCatalogPolicy)],
])

const activeSlices = SLICES.filter(
  (slice) => !requestedVertical || slice.vertical === requestedVertical,
)

const service = createIndexerService({
  adapter: indexer,
  slices: activeSlices,
  registries,
})

console.info(`[reindex] ensuring collections for ${activeSlices.length} slice(s)`)
await service.ensureCollections()

if (!requestedVertical || requestedVertical === "products") {
  const rows = await db.select().from(products)
  console.info(`[reindex] products: ${rows.length} rows`)

  const baseBuilder = createProductDocumentBuilder(db, { sellerOperatorId })
  const builder: DocumentBuilder = embeddings
    ? async (entityId, slice): Promise<IndexerDocument | null> => {
        const doc = await baseBuilder(entityId, slice)
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
          console.warn(`[reindex] embedding failed for ${slice.vertical}/${entityId}: ${message}`)
          return doc
        }
      }
    : baseBuilder

  let done = 0
  for (const row of rows) {
    await service.reindexEntity("products", row.id, builder)
    done++
    if (done % 25 === 0) console.info(`[reindex] products: ${done}/${rows.length}`)
  }
  const productSliceCount = activeSlices.filter((s) => s.vertical === "products").length
  console.info(`[reindex] products: done (${done} entities × ${productSliceCount} slices)`)
}

console.info("[reindex] complete")
process.exit(0)

function composeMerchandisableText(doc: IndexerDocument): string {
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
