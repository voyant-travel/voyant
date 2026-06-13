/**
 * Source discovery sync CLI — pulls projections from every registered
 *
 * agent-quality: file-size exception -- Source sync CLI keeps adapter setup, indexing, and progress reporting together until CLI phases are split into reusable modules.
 *
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
 *   DATABASE_URL              — catalog DB where sourced-entry rows are upserted
 *
 * Configure at least one source adapter:
 *   CATALOG_DEMO_API_URL      — demo upstream URL
 *   VOYANT_API_KEY            — Voyant API key, used for Connect + embeddings
 *   VOYANT_CONNECT_OPERATOR_ID
 *
 * Env optional:
 *   VOYANT_CONNECT_API_URL
 *   VOYANT_CONNECT_MARKET
 *   VOYANT_CONNECT_SYNC_LIMIT
 *   VOYANT_CATALOG_EMBEDDINGS — set to `false` to skip sync-time embeddings
 *   VOYANT_CLOUD_API_KEY      — legacy alias for VOYANT_API_KEY
 *   VOYANT_CONNECT_API_KEY    — legacy alias for VOYANT_API_KEY
 */

import {
  createGeminiEmbeddingProvider,
  createIndexerService,
  createTypesenseIndexer,
  type DocumentBuilder,
  type EmbeddingProvider,
  type IndexerDocument,
  type IndexerSlice,
  type TypesenseClient,
} from "@voyantjs/catalog"
import {
  createSourceAdapterRegistry,
  type SyncSourcesSummary,
  syncSources,
} from "@voyantjs/catalog/booking-engine"
import {
  type CatalogProjection,
  createVoyantConnectSourceAdapter,
  type SourceAdapter,
} from "@voyantjs/connect-adapter"
import { createVoyantConnectClient, type VoyantConnectClient } from "@voyantjs/connect-sdk"
import { createDemoCatalogAdapter } from "@voyantjs/plugin-catalog-demo"
import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { Client as TypesenseSdkClient } from "typesense"
import { getFieldPolicyRegistries } from "../src/api/lib/catalog-runtime.js"
import {
  createConnectCruiseSourceAdapter,
  skipCruiseConnectDocuments,
} from "../src/api/lib/connect-cruise-source.js"
import {
  createDestinationNameResolver,
  createGeoNameResolver,
} from "../src/api/lib/geo-resolver.js"

function asTypesenseClient(client: TypesenseSdkClient): TypesenseClient {
  return client as never
}

config({ path: ".env" })
config({ path: "../../.env" })
config({ path: "../../.env.local" })
config({ path: ".dev.vars", override: true })

const typesenseHost = process.env.TYPESENSE_HOST
const typesenseKey = process.env.TYPESENSE_ADMIN_API_KEY ?? process.env.TYPESENSE_API_KEY
const cloudApiKey =
  process.env.VOYANT_CATALOG_EMBEDDINGS === "false"
    ? undefined
    : (process.env.VOYANT_API_KEY ?? process.env.VOYANT_CLOUD_API_KEY)
const cloudApiUrl = (process.env.VOYANT_CLOUD_API_URL ?? "https://api.voyantjs.com").replace(
  /\/$/,
  "",
)
const catalogDemoUrl = process.env.CATALOG_DEMO_API_URL
const voyantConnectApiKey =
  process.env.VOYANT_API_KEY ??
  process.env.VOYANT_CONNECT_API_KEY ??
  process.env.VOYANT_CLOUD_API_KEY
const voyantConnectApiUrl = process.env.VOYANT_CONNECT_API_URL
const voyantConnectMarket = process.env.VOYANT_CONNECT_MARKET
const voyantConnectOperatorId = process.env.VOYANT_CONNECT_OPERATOR_ID
const voyantConnectSyncLimit = process.env.VOYANT_CONNECT_SYNC_LIMIT
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
if (voyantConnectApiKey || voyantConnectOperatorId) {
  if (!voyantConnectApiKey || !voyantConnectOperatorId) {
    console.warn(
      "[sync-sources] incomplete Voyant Connect config; set VOYANT_API_KEY, " +
        "and VOYANT_CONNECT_OPERATOR_ID to enable it.",
    )
  } else {
    const client = createVoyantConnectClient({
      apiKey: voyantConnectApiKey,
      operatorId: voyantConnectOperatorId,
      baseUrl: voyantConnectApiUrl,
    })
    const connections = (await client.connections.list(voyantConnectOperatorId)).filter(
      (connection) => connection.status === "active",
    )
    if (connections.length === 0) {
      console.warn(
        `[sync-sources] Voyant Connect has no active connections for operator ${voyantConnectOperatorId}`,
      )
    }
    // Resolve canonical-geography ids (ports/regions/waterways) to display
    // names via Voyant Data geo so the catalog shows "Istanbul", not
    // "city:geonames:745044".
    const geoResolver = createGeoNameResolver({
      apiKey: voyantConnectApiKey,
      baseUrl: cloudApiUrl,
    })
    // Resolves sourced package destination tokens (IATA airport codes like
    // `AYT`/`PMI` → "Antalya"/"Palma") via Voyant Data air.
    const destinationResolver = createDestinationNameResolver({
      apiKey: voyantConnectApiKey,
      baseUrl: cloudApiUrl,
    })
    for (const connection of connections) {
      const connectionDetail = await client.connections
        .get(voyantConnectOperatorId, connection.id)
        .catch(() => connection)
      const sourceProvider = inferConnectSourceProvider(connectionDetail)
      registry.register(
        connection.id,
        createVoyantConnectSourceAdapter({
          client,
          operatorId: voyantConnectOperatorId,
          sourceProvider,
          market: voyantConnectMarket,
          discoverLimit: positiveInteger(voyantConnectSyncLimit) ?? 500,
          // Cruises are sourced through the structured cruise adapter below so
          // the canonical geography survives; skip them on the generic path.
          mapDocument: skipCruiseConnectDocuments,
        }),
      )
      // Structured cruise sourcing — lands sourced cruises in the cruise
      // vertical with facetable geography (waterways / regions / countries +
      // canonical ids) instead of the generic flat discovery doc. Cruises are
      // the `scheduled` supply mechanic (fixed dated sailings + allotment).
      registry.register(
        `${connection.id}:cruises`,
        withSupplyModel(
          createConnectCruiseSourceAdapter(
            {
              client,
              operatorId: voyantConnectOperatorId,
              connectionIds: [connection.id],
              sourceProvider,
            },
            undefined,
            { geo: geoResolver },
          ),
          "scheduled",
        ),
      )
      if (sourceProvider === "tui") {
        registry.register(
          `${connection.id}:products`,
          createConnectProductPackageSourceAdapter({
            client,
            operatorId: voyantConnectOperatorId,
            connectionId: connection.id,
            sourceProvider,
            resolveDestination: (token) => destinationResolver.resolve(token),
          }),
        )
      }
    }
  }
}

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
  client: asTypesenseClient(tsClient),
  vectorDimensions: embeddings?.capabilities.dimensions,
})

// Index with the SAME composed field-policy registries the search runtime uses
// (catalog-runtime). Single source of truth, so the indexed collection always
// has every field search can sort/filter/facet on — otherwise search-only
// fields 404 (e.g. price sort on `priceFromAmountCents`, departure sort on
// `nextDepartureAt`).
const fieldPolicyRegistries = getFieldPolicyRegistries()

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

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function createConnectProductPackageSourceAdapter(options: {
  client: VoyantConnectClient
  operatorId: string
  connectionId: string
  sourceProvider: string
  /** Resolve a destination token (IATA code or name) to a readable label. */
  resolveDestination?: (token: string) => Promise<string>
}): SourceAdapter {
  return {
    kind: "voyant-connect:tui-products",
    capabilities: {
      verticals: ["products"],
      supportsLiveResolution: false,
      supportsDriftDetection: false,
      supportsBookingForwarding: false,
      supportsReservationRetrieval: false,
      supportsSyncCancellation: false,
      postBookOperations: [],
      supportsContentFetch: false,
      ownsContentCache: false,
      ownsAvailabilityCache: false,
    },
    async discover(_ctx, cursor) {
      if (cursor) return { projections: [], next_cursor: undefined }
      const rows = await options.client.products.listOnConnection(options.connectionId)

      // Star rating lives on the accommodation (hotel) record, not the package
      // product row — join by externalId. The accommodations list caps at 500
      // per call with no cursor, so page it by the package countries (each
      // country is well under the cap).
      // Star rating lives on the accommodation (hotel) record, not the package
      // product row — join by externalId. The accommodations list caps at 500
      // per call with no cursor, so page it by the package countries (each
      // country is well under the cap).
      const starsByAccommodation = new Map<string, number>()
      const countryCodes = new Set<string>()
      for (const row of rows) {
        const cc = stringValue(recordValue((row as Record<string, unknown>).package)?.countryCode)
        if (cc) countryCodes.add(cc)
      }
      await Promise.all(
        [...countryCodes].map(async (countryCode) => {
          try {
            const accommodations = await options.client.accommodations.list({
              connectionId: options.connectionId,
              countryCode,
              limit: 500,
            })
            if (accommodations.length >= 500) {
              console.warn(
                `[sync-sources] accommodations.list hit the 500 cap for ${countryCode}; some star ratings may be missing`,
              )
            }
            for (const accommodation of accommodations) {
              const ext = stringValue((accommodation as Record<string, unknown>).externalId)
              const stars = numberValue((accommodation as Record<string, unknown>).stars)
              if (ext && stars != null) starsByAccommodation.set(ext, stars)
            }
          } catch (err) {
            console.warn(
              `[sync-sources] could not load stars for ${countryCode}: ${err instanceof Error ? err.message : String(err)}`,
            )
          }
        }),
      )

      // Resolve every distinct destination token once (cached in the resolver).
      const destinationLabels = new Map<string, string>()
      if (options.resolveDestination) {
        const tokens = new Set<string>()
        for (const row of rows) {
          for (const token of stringArrayValue((row as Record<string, unknown>).destinations)) {
            tokens.add(token)
          }
        }
        await Promise.all(
          [...tokens].map(async (token) => {
            destinationLabels.set(
              token,
              (await options.resolveDestination?.(token).catch(() => token)) ?? token,
            )
          }),
        )
      }

      return {
        projections: rows
          .map((row) =>
            mapConnectPackageProductToProjection(row as Record<string, unknown>, options, {
              starsByAccommodation,
              destinationLabels,
            }),
          )
          .filter((projection): projection is CatalogProjection => projection !== null),
        next_cursor: undefined,
      }
    },
  }
}

function mapConnectPackageProductToProjection(
  row: Record<string, unknown>,
  options: {
    operatorId: string
    connectionId: string
    sourceProvider: string
  },
  enrich: {
    starsByAccommodation: Map<string, number>
    destinationLabels: Map<string, string>
  },
): CatalogProjection | null {
  const id = stringValue(row.id)
  if (!id) return null

  const packagePayload = recordValue(row.package)
  const meta = recordValue(row.meta)
  const freshness = recordValue(meta?.freshness)
  const source = recordValue(meta?.source)
  const refreshedAt = stringValue(freshness?.refreshedAt) ?? stringValue(meta?.updatedAt)
  const title = stringValue(row.title) ?? id
  const summary = stringValue(row.summary)
  const heroImageUrl = stringValue(packagePayload?.heroImageUrl)
  const totalPrice = recordValue(packagePayload?.totalPrice)
  const pricePerPerson = recordValue(packagePayload?.pricePerPerson)
  const sellPrice = totalPrice ?? pricePerPerson
  const tags = stringArrayValue(row.tags)
  const board = stringValue(packagePayload?.board) ?? null
  const countryCode = stringValue(packagePayload?.countryCode)
  const transport = packagePayload?.flightIncluded === true ? "flight" : null
  const accommodationExternalId = stringValue(packagePayload?.accommodationExternalId)
  const starsValue = accommodationExternalId
    ? (enrich.starsByAccommodation.get(accommodationExternalId) ?? null)
    : null
  // `stars` is a string field in the index schema; serialize the numeric rating.
  const stars = starsValue != null ? String(starsValue) : null
  const destinations = stringArrayValue(row.destinations).map(
    (token) => enrich.destinationLabels.get(token) ?? token,
  )
  // Supply mechanic — prefer the source value (Connect ships it on search docs;
  // not yet on the product row), default to dynamic for TUI flight+hotel.
  const supplyModel =
    stringValue(row.supplyModel) ?? stringValue(packagePayload?.supplyModel) ?? "dynamic"

  return {
    entity_module: "products",
    entity_id: id,
    provenance: {
      source_kind: "voyant-connect",
      source_provider: options.sourceProvider,
      source_connection_id: options.connectionId,
      source_ref: id,
      source_freshness: "sync",
      ...(refreshedAt ? { last_sourced_at: new Date(refreshedAt) } : {}),
    },
    fields: {
      id,
      "source.kind": "voyant-connect",
      "source.ref": id,
      "source.connection_id": options.connectionId,
      "seller.operator_id": options.operatorId,
      supplierId: stringValue(row.supplierId) ?? stringValue(source?.providerKey) ?? "tui",
      productId: id,
      status: "active",
      activated: true,
      bookingMode: stringValue(packagePayload?.bookingMode) ?? "stay",
      capacityMode: "on_request",
      visibility: "public",
      productTypeId: stringValue(row.productType) ?? "package",
      name: title,
      title,
      slug: stringValue(row.slug) ?? id,
      shortDescription: summary,
      description: summary,
      tags,
      primaryMediaUrl: heroImageUrl,
      thumbnailUrl: heroImageUrl,
      coverMediaUrl: heroImageUrl,
      sellAmountCents: numberValue(sellPrice?.amountMinor),
      sellCurrency:
        stringValue(sellPrice?.currency) ??
        stringValue(row.defaultCurrency) ??
        stringValue(packagePayload?.currency),
      // "From" price — for a sourced package the sell price IS the from price.
      // Same field the pricing extension fills for owned products, so the card,
      // price sort and price filter all use `priceFromAmountCents` everywhere.
      priceFromAmountCents: numberValue(sellPrice?.amountMinor),
      priceFromCurrency:
        stringValue(sellPrice?.currency) ??
        stringValue(row.defaultCurrency) ??
        stringValue(packagePayload?.currency),
      hasPricing: numberValue(sellPrice?.amountMinor) != null,
      durationDays: numberValue(packagePayload?.nights),
      // Sourced merchandising facets, straight off the package payload.
      board,
      stars,
      transport,
      destinations,
      countryCodes: countryCode ? [countryCode] : [],
      supplyModel,
      updatedAt: refreshedAt ?? new Date().toISOString(),
      connect_document: row,
    },
  }
}

/** Wrap an adapter's discover() to tag every projection with a supply model. */
// Default the supply mechanic for adapters whose upstream doesn't ship one yet
// (connect-cruises has no supplyModel field) — a source-provided value wins.
function withSupplyModel(adapter: SourceAdapter, defaultSupplyModel: string): SourceAdapter {
  const discover = adapter.discover?.bind(adapter)
  if (!discover) return adapter
  return {
    ...adapter,
    async discover(...args: Parameters<NonNullable<SourceAdapter["discover"]>>) {
      const page = await discover(...args)
      return {
        ...page,
        projections: page.projections.map((projection) => ({
          ...projection,
          fields: {
            ...projection.fields,
            supplyModel: stringValue(projection.fields.supplyModel) ?? defaultSupplyModel,
          },
        })),
      }
    },
  }
}

function inferConnectSourceProvider(connection: unknown): string | undefined {
  const record = recordValue(connection)
  if (!record) return undefined
  const providerKey = stringValue(record.providerKey)
  if (providerKey) return providerKey
  const supplierName = stringValue(record.supplierName)?.toLowerCase()
  if (!supplierName) return undefined
  if (supplierName.includes("tui")) return "tui"
  if (supplierName.includes("viking")) return "viking"
  if (supplierName.includes("uniworld")) return "uniworld"
  return undefined
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : []
}
