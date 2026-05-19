/**
 * Source discovery sync CLI — pulls projections from every registered
 * `SourceAdapter` (Voyant Connect peers, GDS connectors, the demo
 * upstream at `apps/catalog-demo-api`) and pushes them into the
 * deployment's Typesense index. Sourced rows then show up in the
 * Catalog UI alongside the operator's owned products.
 *
 * Usage (from templates/operator):
 *   pnpm exec tsx scripts/sync-sources.ts
 *   pnpm sync:sources
 *
 * Env required:
 *   TYPESENSE_HOST            — e.g. http://localhost:8108
 *   TYPESENSE_ADMIN_API_KEY   — admin key (or TYPESENSE_API_KEY)
 *   CATALOG_DEMO_API_URL      — the demo upstream's URL when the demo
 *                               adapter should participate
 *
 * Env optional:
 *   VOYANT_CLOUD_API_KEY      — when set, projections get a
 *                               `text_embedding` vector via the Voyant
 *                               Cloud Gemini gateway. Without it,
 *                               sourced rows are keyword-only.
 */

import { accommodationCatalogPolicy } from "@voyantjs/accommodations/catalog-policy"
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
import {
  createSourceAdapterRegistry,
  type SyncSourcesSummary,
  syncSources,
} from "@voyantjs/catalog/booking-engine"
import { createGeminiEmbeddingProvider, type EmbeddingProvider } from "@voyantjs/catalog-rag"
import { charterCatalogPolicy } from "@voyantjs/charters/catalog-policy"
import { cruiseCatalogPolicy } from "@voyantjs/cruises/catalog-policy"
import { extrasCatalogPolicy } from "@voyantjs/extras/catalog-policy"
import { createDemoCatalogAdapter } from "@voyantjs/plugin-catalog-demo"
import { productCatalogPolicy } from "@voyantjs/products/catalog-policy"
import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { Client as TypesenseSdkClient } from "typesense"

config({ path: ".env" })
config({ path: "../../.env" })
config({ path: "../../.env.local" })
config({ path: ".dev.vars", override: true })

const typesenseHost = process.env.TYPESENSE_HOST
const typesenseKey = process.env.TYPESENSE_ADMIN_API_KEY ?? process.env.TYPESENSE_API_KEY
const cloudApiKey = process.env.VOYANT_CLOUD_API_KEY
const cloudApiUrl = (process.env.VOYANT_CLOUD_API_URL ?? "https://api.voyantjs.com").replace(
  /\/$/,
  "",
)
const catalogDemoUrl = process.env.CATALOG_DEMO_API_URL
const databaseUrl = process.env.DATABASE_URL

if (!typesenseHost) throw new Error("TYPESENSE_HOST is not set")
if (!typesenseKey) throw new Error("TYPESENSE_ADMIN_API_KEY is not set")
if (!databaseUrl) throw new Error("DATABASE_URL is not set")

// Drizzle client. The sync upserts a row into `catalog_sourced_entries`
// for every projection alongside the indexer write so the catalog
// detail sheet's content endpoint (and the snapshot capture path) can
// resolve the entity by its catalog-side id (sourced-content §2.5.2).
const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} })
const db = drizzle(sql)

// ── Registry: register every adapter the deployment supports ─────────────
const registry = createSourceAdapterRegistry()
if (catalogDemoUrl) {
  registry.register(createDemoCatalogAdapter({ baseUrl: catalogDemoUrl }))
}
// Add other adapters here as they ship: voyant-connect, hotelbeds, etc.
// registry.register(createVoyantConnectAdapter({ ... }))

const adapterKinds = registry.kinds()
if (adapterKinds.length === 0) {
  console.warn(
    "[sync-sources] no SourceAdapters are registered — set CATALOG_DEMO_API_URL or wire " +
      "another adapter to populate the index from sourced inventory.",
  )
  process.exit(0)
}

console.info(`[sync-sources] registered adapters: ${adapterKinds.join(", ")}`)

// ── Indexer + embeddings (mirrors scripts/reindex.ts wiring) ─────────────
const embeddings: EmbeddingProvider | undefined = cloudApiKey
  ? createGeminiEmbeddingProvider({
      apiKey: cloudApiKey,
      auth: "bearer",
      baseUrl: `${cloudApiUrl}/ai/v1/gemini`,
    })
  : undefined

if (embeddings) {
  console.info(
    `[sync-sources] embeddings enabled — model=${embeddings.capabilities.modelId} dims=${embeddings.capabilities.dimensions}`,
  )
} else {
  console.info("[sync-sources] embeddings disabled — keyword-only index")
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

const fieldPolicyRegistries = new Map<string, FieldPolicyRegistry>([
  ["products", createFieldPolicyRegistry(productCatalogPolicy)],
  ["extras", createFieldPolicyRegistry(extrasCatalogPolicy)],
  ["cruises", createFieldPolicyRegistry(cruiseCatalogPolicy)],
  ["charters", createFieldPolicyRegistry(charterCatalogPolicy)],
  ["accommodations", createFieldPolicyRegistry(accommodationCatalogPolicy)],
])

const VERTICALS = ["products", "extras", "cruises", "charters", "accommodations"] as const
const slices: IndexerSlice[] = VERTICALS.flatMap((vertical) => [
  { vertical, locale: "en-GB", audience: "staff", market: "default" },
  { vertical, locale: "en-GB", audience: "customer", market: "default" },
])

const indexerService = createIndexerService({
  adapter: indexer,
  slices,
  registries: fieldPolicyRegistries,
})

console.info(`[sync-sources] ensuring collections for ${slices.length} slice(s)`)
await indexerService.ensureCollections()

// ── Run the sync ─────────────────────────────────────────────────────────
const wrapBuilder = embeddings
  ? (inner: DocumentBuilder): DocumentBuilder =>
      async (entityId, slice): Promise<IndexerDocument | null> => {
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
          console.warn(
            `[sync-sources] embedding failed for ${slice.vertical}/${entityId}: ${message}`,
          )
          return doc
        }
      }
  : undefined

const summary: SyncSourcesSummary = await syncSources({
  registry,
  indexerService,
  fieldPolicyRegistries,
  db,
  ...(wrapBuilder ? { wrapBuilder } : {}),
  onProgress(event) {
    console.info(
      `[sync-sources] ${event.adapter}: page ${event.page}, +${event.pageSize} → ${event.totalSoFar}`,
    )
  },
})

console.info("[sync-sources] complete")
for (const adapter of summary.adapters) {
  const verticals = adapter.verticalsTouched.join(",") || "(none)"
  console.info(
    `[sync-sources]   · ${adapter.adapter}: ${adapter.projectionsSynced} projection(s) across [${verticals}], skipped ${adapter.skippedNoRegistry}, sourced-entries upserted ${adapter.sourcedEntriesUpserted}`,
  )
}
console.info(`[sync-sources] total projections synced: ${summary.totalProjections}`)
await sql.end()
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
  return parts.join(" — ")
}
