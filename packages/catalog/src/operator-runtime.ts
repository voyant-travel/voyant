import type { SourceAdapterContext } from "./adapter/contract.js"
import type {
  BookEntityResult,
  CatalogBookingBookBody,
  CatalogBookingPrepareBookParametersInput,
  QuoteEntityResult,
  SourceAdapterRegistry,
} from "./booking-engine/index.js"
import type {
  CatalogBookingSnapshotExecutionContext,
  CatalogBookingSnapshotRuntime,
} from "./booking-snapshot-subscriber-runtime.js"
import type { FieldPolicyRegistry } from "./contract.js"
import type { EmbeddingProvider } from "./embeddings/contract.js"
import { createGeminiEmbeddingProvider } from "./embeddings/gemini.js"
import type { IndexerAdapter, IndexerDocument, IndexerSlice } from "./indexer/contract.js"
import {
  createTypesenseIndexer,
  type TypesenseClient,
  type TypesenseCollectionSchema,
  type TypesenseSearchQuery,
  type TypesenseSearchResponse,
} from "./indexer/typesense.js"
import type {
  CatalogOffersIndexFields,
  CatalogOffersSearchDestination,
} from "./offers/operator-routes.js"
import {
  type CatalogProjectionRuntime,
  createEnsureCatalogCollectionsSerializer,
} from "./projection-runtime.js"
import { createIndexerService, type DocumentBuilder } from "./services/indexer-service.js"

export const DEFAULT_CATALOG_VERTICALS = [
  "products",
  "extras",
  "cruises",
  "charters",
  "accommodations",
] as const

export const DEFAULT_CATALOG_SLICES: ReadonlyArray<IndexerSlice> =
  DEFAULT_CATALOG_VERTICALS.flatMap((vertical) => [
    { vertical, locale: "en-GB", audience: "staff", market: "default" },
    { vertical, locale: "en-GB", audience: "customer", market: "default" },
  ])

export interface CatalogMarketRow {
  id: string
  defaultLanguageTag: string
}

export interface CatalogLocaleRow {
  marketId: string
  languageTag: string
}

export function buildCatalogSlices(input: {
  markets: readonly CatalogMarketRow[]
  locales: readonly CatalogLocaleRow[]
  channelIds: readonly string[]
}): IndexerSlice[] {
  const localesByMarket = new Map<string, Set<string>>()
  for (const market of input.markets) {
    localesByMarket.set(market.id, new Set([market.defaultLanguageTag]))
  }
  for (const locale of input.locales) {
    localesByMarket.get(locale.marketId)?.add(locale.languageTag)
  }

  const customerChannels = [undefined, ...input.channelIds]
  const defaultChannelSlices = input.channelIds.flatMap((channel) =>
    DEFAULT_CATALOG_SLICES.filter(
      (slice) => slice.audience === "customer" && slice.market === "default" && !slice.channel,
    ).map((slice) => ({ ...slice, channel })),
  )
  const marketSlices = input.markets.flatMap((market) => {
    const locales = localesByMarket.get(market.id) ?? new Set([market.defaultLanguageTag])
    return DEFAULT_CATALOG_VERTICALS.flatMap((vertical) =>
      Array.from(locales).flatMap((locale) => [
        { vertical, locale, audience: "staff" as const, market: market.id },
        ...customerChannels.map((channel) => ({
          vertical,
          locale,
          audience: "customer" as const,
          market: market.id,
          channel,
        })),
      ]),
    )
  })
  return uniqueSlices([...DEFAULT_CATALOG_SLICES, ...defaultChannelSlices, ...marketSlices])
}

function uniqueSlices(slices: ReadonlyArray<IndexerSlice>): IndexerSlice[] {
  const seen = new Set<string>()
  return slices.filter((slice) => {
    const key = [
      slice.vertical,
      slice.locale,
      slice.audience,
      slice.market,
      slice.channel ?? "",
    ].join("|")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function withCatalogEmbedding(
  inner: (entityId: string, slice: IndexerSlice) => Promise<IndexerDocument | null>,
  embeddings:
    | {
        capabilities: { modelId: string }
        embed(input: string[]): Promise<number[][]>
      }
    | undefined,
): typeof inner {
  if (!embeddings) return inner
  return async (entityId, slice) => {
    const document = await inner(entityId, slice)
    if (!document) return null
    const text = merchandisableText(document)
    if (!text) return document
    try {
      const [vector] = await embeddings.embed([text])
      if (!vector) return document
      return {
        ...document,
        embeddings: { ...(document.embeddings ?? {}), text_embedding: vector },
        embedding_model_id: embeddings.capabilities.modelId,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[catalog] embedding failed for ${slice.vertical}/${entityId}: ${message}`)
      return document
    }
  }
}

function merchandisableText(document: IndexerDocument): string {
  const values = [document.fields.name, document.fields.description]
  const parts = values.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  )
  const tags = document.fields.tags
  if (Array.isArray(tags)) {
    parts.push(...tags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0))
  }
  return parts.join(" ")
}

export interface CatalogOffersTypesenseEnv {
  TYPESENSE_HOST?: string
  TYPESENSE_ADMIN_API_KEY?: string
  TYPESENSE_API_KEY?: string
}

export interface CatalogNodeRuntimeEnv extends CatalogOffersTypesenseEnv {
  VOYANT_API_KEY?: string
  VOYANT_CLOUD_API_KEY?: string
  VOYANT_CLOUD_API_URL?: string
}

export function buildCatalogEmbeddingProvider(
  env: CatalogNodeRuntimeEnv,
): EmbeddingProvider | undefined {
  const apiKey = env.VOYANT_API_KEY ?? env.VOYANT_CLOUD_API_KEY
  if (!apiKey) return undefined
  const cloudBase = (env.VOYANT_CLOUD_API_URL ?? "https://api.voyant.travel").replace(/\/$/, "")
  return createGeminiEmbeddingProvider({
    apiKey,
    auth: "bearer",
    baseUrl: `${cloudBase}/ai/v1/gemini`,
  })
}

export function buildCatalogTypesenseIndexer(
  env: CatalogNodeRuntimeEnv,
  options: {
    embeddings?: EmbeddingProvider
    registries: ReadonlyMap<string, FieldPolicyRegistry>
  },
): IndexerAdapter | undefined {
  const host = env.TYPESENSE_HOST
  const apiKey = env.TYPESENSE_ADMIN_API_KEY ?? env.TYPESENSE_API_KEY
  if (!host || !apiKey) return undefined
  try {
    new URL(host)
  } catch {
    return undefined
  }
  return createTypesenseIndexer({
    client: createTypesenseFetchClient(host, apiKey),
    vectorDimensions: options.embeddings?.capabilities.dimensions,
    registries: options.registries,
  })
}

function createTypesenseFetchClient(host: string, apiKey: string): TypesenseClient {
  const baseUrl = host.replace(/\/$/, "")
  const baseHeaders = { "X-TYPESENSE-API-KEY": apiKey }
  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    headers.set("X-TYPESENSE-API-KEY", apiKey)
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`Typesense ${init.method ?? "GET"} ${path} ${response.status}: ${body}`)
    }
    return response
  }
  function searchPath(name: string, query: TypesenseSearchQuery) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value != null) params.set(key, String(value))
    }
    return `/collections/${encodeURIComponent(name)}/documents/search?${params.toString()}`
  }
  return {
    collections(name?: string) {
      return {
        async create(schema: TypesenseCollectionSchema) {
          await request("/collections", { method: "POST", body: JSON.stringify(schema) })
        },
        async update(schema: Partial<TypesenseCollectionSchema>) {
          if (!name) throw new Error("update requires a collection name")
          await request(`/collections/${encodeURIComponent(name)}`, {
            method: "PATCH",
            body: JSON.stringify(schema),
          })
        },
        async delete() {
          if (!name) throw new Error("delete requires a collection name")
          await request(`/collections/${encodeURIComponent(name)}`, { method: "DELETE" })
        },
        async retrieve() {
          if (!name) throw new Error("retrieve requires a collection name")
          return (await request(`/collections/${encodeURIComponent(name)}`).then((result) =>
            result.json(),
          )) as TypesenseCollectionSchema
        },
        documents() {
          if (!name) throw new Error("documents() requires a collection name")
          return {
            import: async (documents: unknown[], options?: { action?: "upsert" | "create" }) => {
              const action = options?.action ?? "create"
              const response = await fetch(
                `${baseUrl}/collections/${encodeURIComponent(name)}/documents/import?action=${action}`,
                {
                  method: "POST",
                  headers: { ...baseHeaders, "Content-Type": "text/plain" },
                  body: documents.map((document) => JSON.stringify(document)).join("\n"),
                },
              )
              if (!response.ok) {
                const body = await response.text().catch(() => "")
                throw new Error(`Typesense import ${name} ${response.status}: ${body}`)
              }
              return response.text()
            },
            async delete(query: { filter_by: string }) {
              const params = new URLSearchParams({ filter_by: query.filter_by })
              return request(
                `/collections/${encodeURIComponent(name)}/documents?${params.toString()}`,
                { method: "DELETE" },
              ).then((result) => result.json())
            },
            async search(query: TypesenseSearchQuery): Promise<TypesenseSearchResponse> {
              return request(searchPath(name, query)).then(
                (result) => result.json() as Promise<TypesenseSearchResponse>,
              )
            },
          }
        },
      }
    },
  }
}

function typesenseConfig(env: CatalogOffersTypesenseEnv) {
  const key = env.TYPESENSE_ADMIN_API_KEY ?? env.TYPESENSE_API_KEY
  if (!env.TYPESENSE_HOST || !key) return null
  const base = env.TYPESENSE_HOST.startsWith("http")
    ? env.TYPESENSE_HOST.replace(/\/$/, "")
    : `https://${env.TYPESENSE_HOST}`
  return { base, key }
}

export function createCatalogOffersTypesenseResolvers(
  resolveEnv: (context: unknown) => CatalogOffersTypesenseEnv,
) {
  return {
    async fetchIndexFields(context: unknown, ids: string[]) {
      const config = typesenseConfig(resolveEnv(context))
      const output = new Map<string, CatalogOffersIndexFields>()
      if (!config || ids.length === 0) return output
      const distinct = [...new Set(ids)]
      for (let index = 0; index < distinct.length; index += 80) {
        const batch = distinct.slice(index, index + 80)
        const filter = `id:=[${batch.map((id) => `\`${id}\``).join(",")}]`
        const url =
          `${config.base}/collections/products__en-GB__staff__default/documents/search` +
          `?q=*&query_by=name&filter_by=${encodeURIComponent(filter)}&per_page=${batch.length}` +
          "&include_fields=id,name,thumbnailUrl,stars,destinations,countryCodes"
        try {
          const response = (await fetch(url, {
            headers: { "X-TYPESENSE-API-KEY": config.key },
          }).then((result) => result.json())) as {
            hits?: Array<{ document?: CatalogOffersIndexFields & { id?: string } }>
          }
          for (const hit of response.hits ?? []) {
            if (hit.document?.id) output.set(hit.document.id, hit.document)
          }
        } catch {
          // Offer enrichment is best-effort.
        }
      }
      return output
    },
    async resolveDynamicHotelIds(
      context: unknown,
      destination: CatalogOffersSearchDestination,
      limit: number,
    ) {
      const config = typesenseConfig(resolveEnv(context))
      if (!config) return []
      const filters = ["supplyModel:=dynamic"]
      if (destination.countryCode) filters.push(`countryCodes:=[\`${destination.countryCode}\`]`)
      if (destination.city) filters.push(`destinations:=[\`${destination.city}\`]`)
      const url =
        `${config.base}/collections/products__en-GB__staff__default/documents/search` +
        `?q=*&query_by=name&filter_by=${encodeURIComponent(filters.join(" && "))}` +
        `&per_page=${Math.min(limit, 250)}&include_fields=id`
      try {
        const response = (await fetch(url, {
          headers: { "X-TYPESENSE-API-KEY": config.key },
        }).then((result) => result.json())) as { hits?: Array<{ document?: { id?: string } }> }
        return (response.hits ?? [])
          .map((hit) => hit.document?.id)
          .filter((id): id is string => Boolean(id))
      } catch {
        return []
      }
    },
  }
}

export function createProductQuoteShapeEnricher(dependencies: {
  resolveContent(input: {
    db: unknown
    entityId: string
    locales: string[]
    market?: string
    currency?: string
    registry: SourceAdapterRegistry
    adapterContext: SourceAdapterContext
  }): Promise<{ content?: unknown } | null>
  buildShape(
    content: unknown,
    options: { locale?: string },
  ): NonNullable<QuoteEntityResult["shape"]>
}) {
  return async (input: {
    db: unknown
    result: QuoteEntityResult
    entityModule: string
    entityId: string
    locale?: string
    market?: string
    currency?: string
    registry: SourceAdapterRegistry
    adapterContext?: SourceAdapterContext
  }): Promise<QuoteEntityResult> => {
    if (input.result.shape || !input.result.available || input.entityModule !== "products") {
      return input.result
    }
    try {
      const locales = [...new Set([input.locale, "en-GB", "en"].filter(Boolean))] as string[]
      const resolved = await dependencies.resolveContent({
        db: input.db,
        entityId: input.entityId,
        locales,
        market: input.market,
        currency: input.currency,
        registry: input.registry,
        adapterContext: input.adapterContext ?? { connection_id: "products" },
      })
      if (!resolved?.content) return input.result
      return {
        ...input.result,
        shape: dependencies.buildShape(resolved.content, { locale: input.locale }),
      }
    } catch (error) {
      console.warn("[catalog-booking] product quote shape enrichment failed:", error)
      return input.result
    }
  }
}

export interface SourcedBookingRowValues {
  booking: Record<string, unknown>
  item: Record<string, unknown>
  activity: Record<string, unknown>
}

export function createCatalogProjectionRuntimeAdapter<TBindings, TDb>(options: {
  bindings: TBindings
  withDb<R>(bindings: TBindings, operation: (db: TDb) => Promise<R>): Promise<R>
  buildContext(db: TDb): Promise<{
    adapter: IndexerAdapter
    slices: IndexerSlice[]
    registries: ReadonlyMap<string, FieldPolicyRegistry>
    builder: DocumentBuilder
  } | null>
}): CatalogProjectionRuntime {
  const ensureCollections = createEnsureCatalogCollectionsSerializer()
  async function withIndexer(
    operation: (
      context: NonNullable<Awaited<ReturnType<typeof options.buildContext>>>,
    ) => Promise<void>,
  ) {
    await options.withDb(options.bindings, async (db) => {
      const context = await options.buildContext(db)
      if (context) await operation(context)
    })
  }
  return {
    reindexEntity: ({ entityModule, entityId }) =>
      withIndexer(async ({ adapter, slices, registries, builder }) => {
        const service = createIndexerService({ adapter, slices, registries })
        await ensureCollections(() => service.ensureCollections())
        await service.reindexEntity(entityModule, entityId, builder)
      }),
    deleteEntity: ({ entityModule, entityId }) =>
      withIndexer(async ({ adapter, slices, registries }) => {
        await createIndexerService({ adapter, slices, registries }).deleteEntity(
          entityModule,
          entityId,
        )
      }),
  }
}

export function createCatalogBookingSnapshotRuntimeAdapter<TBindings, TDb>(options: {
  bindings: TBindings
  withDb<R>(bindings: TBindings, operation: (db: TDb) => Promise<R>): Promise<R>
  buildContext(db: TDb): Promise<CatalogBookingSnapshotExecutionContext>
}): CatalogBookingSnapshotRuntime {
  return {
    withContext: (operation) =>
      options.withDb(options.bindings, async (db) => operation(await options.buildContext(db))),
  }
}

export function buildSourcedBookingRowValues(input: {
  request: CatalogBookingBookBody
  result: BookEntityResult
  snapshot: {
    id: string
    entity_module: string
    entity_id: string
    source_kind: string
    source_connection_id: string | null
    source_ref: string | null
    frozen_payload: unknown
    pricing_currency: string | null
  }
  actorId: string
  bookingItemId: string
  bookingNumber: string
}): SourcedBookingRowValues {
  const party = asRecord(input.request.party)
  const billing = asRecord(party?.billing)
  const contact = asRecord(billing?.contact)
  const draft = asRecord(asRecord(input.request.parameters)?.draft)
  const configure = asRecord(draft?.configure)
  const range = asRecord(configure?.dateRange)
  const currency = input.result.pricing?.currency ?? input.snapshot.pricing_currency ?? "EUR"
  const total = input.result.pricing
    ? Math.round(
        input.result.pricing.base_amount +
          input.result.pricing.taxes +
          input.result.pricing.fees +
          input.result.pricing.surcharges,
      )
    : null
  const startDate = dateString(configure?.departureDate) ?? dateString(range?.checkIn) ?? null
  const endDate = dateString(range?.checkOut) ?? startDate
  const status = input.result.status === "held" ? "on_hold" : "confirmed"
  const title = sourcedBookingTitle(input.snapshot.frozen_payload, input.snapshot.entity_id)
  return {
    booking: {
      id: input.result.bookingId,
      bookingNumber: input.bookingNumber,
      status,
      personId: stringValue(party?.personId) ?? stringValue(billing?.personId) ?? null,
      organizationId:
        stringValue(party?.organizationId) ?? stringValue(billing?.organizationId) ?? null,
      sourceType: "api_partner",
      externalBookingRef: input.result.orderRef,
      contactFirstName: stringValue(contact?.firstName) ?? null,
      contactLastName: stringValue(contact?.lastName) ?? null,
      contactEmail: stringValue(contact?.email) ?? null,
      contactPhone: stringValue(contact?.phone) ?? null,
      sellCurrency: currency,
      sellAmountCents: total,
      startDate,
      endDate,
      pax: totalPax(draft),
      internalNotes: `Sourced booking committed via ${input.snapshot.source_kind}. Snapshot: ${input.snapshot.id}`,
    },
    item: {
      id: input.bookingItemId,
      bookingId: input.result.bookingId,
      title,
      itemType: "unit",
      status,
      serviceDate: startDate,
      quantity: 1,
      sellCurrency: currency,
      unitSellAmountCents: total,
      totalSellAmountCents: total,
      productId: input.snapshot.entity_module === "products" ? input.snapshot.entity_id : null,
      sourceSnapshotId: input.snapshot.id,
      sourceOfferId: input.snapshot.source_ref,
      productNameSnapshot: title,
      metadata: {
        entityModule: input.snapshot.entity_module,
        entityId: input.snapshot.entity_id,
        sourceKind: input.snapshot.source_kind,
        sourceConnectionId: input.snapshot.source_connection_id,
        upstreamRef: input.result.orderRef,
      },
    },
    activity: {
      bookingId: input.result.bookingId,
      actorId: input.actorId,
      activityType: "booking_created",
      description: `Booking ${input.bookingNumber} created from sourced catalog order ${input.result.orderRef}`,
      metadata: {
        sourceKind: input.snapshot.source_kind,
        snapshotId: input.snapshot.id,
        orderRef: input.result.orderRef,
      },
    },
  }
}

export function createCatalogPackageHoldPreparer(options: {
  lock(input: {
    context: unknown
    connectionId: string
    offer: Record<string, unknown>
  }): Promise<string | null>
}) {
  return async ({
    c,
    parameters,
    provenance,
    quote,
  }: CatalogBookingPrepareBookParametersInput): Promise<Record<string, unknown>> => {
    if (parameters.connectRoute !== "packages" || stringValue(parameters.holdId)) return parameters
    if (provenance.sourceKind !== "voyant-connect" || !provenance.sourceConnectionId) {
      return parameters
    }
    const payload = asRecord(quote?.upstream_payload)
    const offer = asRecord(payload?.offer) ?? payload
    if (!isPackageOffer(offer)) return parameters
    const holdId = await options.lock({
      context: c,
      connectionId: provenance.sourceConnectionId,
      offer,
    })
    return holdId ? { ...parameters, holdId } : parameters
  }
}

function isPackageOffer(
  offer: Record<string, unknown> | undefined,
): offer is Record<string, unknown> {
  return Boolean(
    offer &&
      stringValue(offer.id) &&
      stringValue(offer.connectionId) &&
      stringValue(offer.supplierId) &&
      asRecord(offer.productRef) &&
      asRecord(offer.stay) &&
      Array.isArray(offer.flights) &&
      asRecord(offer.pricing) &&
      asRecord(offer.cancellationPolicy) &&
      stringValue(offer.expiresAt),
  )
}

export async function resolveCatalogHoldTtlMs(options: {
  entityModule: string
  entityId: string
  defaultTtlMs?: number
  loadProduct(entityId: string): Promise<{
    supplierId?: string | null
    reservationTimeoutMinutes?: number | null
  } | null>
  loadSupplier(supplierId: string): Promise<{ reservationTimeoutMinutes?: number | null } | null>
}): Promise<number> {
  const defaultMinutes = (options.defaultTtlMs ?? 30 * 60 * 1000) / 60_000
  if (options.entityModule !== "products") return defaultMinutes * 60_000
  const product = await options.loadProduct(options.entityId)
  const productMinutes = positiveMinutes(product?.reservationTimeoutMinutes)
  if (productMinutes !== null) return productMinutes * 60_000
  if (!product?.supplierId) return defaultMinutes * 60_000
  const supplier = await options.loadSupplier(product.supplierId)
  return (positiveMinutes(supplier?.reservationTimeoutMinutes) ?? defaultMinutes) * 60_000
}

function positiveMinutes(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null
}

export function createSourcedBookingNumber(now = Date.now(), random = Math.random()): string {
  return `SRC-${now.toString(36).toUpperCase()}-${random.toString(36).slice(2, 6).toUpperCase()}`
}

export interface CatalogQuoteTaxLine {
  amountCents: number
  includedInPrice: boolean
  code?: string | null
  name: string
  rateBasisPoints?: number | null
  scope?: string | null
}

export async function applyCatalogTaxToQuoteResult(input: {
  result: QuoteEntityResult
  entityModule: string
  entityId: string
  sourceKind: string
  ownedSourceKind: string
  resolveTaxLine(input: {
    productId: string | null
    taxableCents: number
    currency: string
  }): Promise<CatalogQuoteTaxLine | null>
  persistPricing(quoteId: string, pricing: NonNullable<QuoteEntityResult["pricing"]>): Promise<void>
}): Promise<QuoteEntityResult> {
  const pricing = input.result.pricing
  if (!input.result.available || !pricing) return input.result
  const hasAppliedOffers = (pricing.appliedOffers?.length ?? 0) > 0
  if (input.sourceKind === input.ownedSourceKind && !hasAppliedOffers) return input.result
  if (pricing.taxes > 0 && !hasAppliedOffers) return input.result

  const taxableCents = pricing.base_amount
  const taxLine = await input.resolveTaxLine({
    productId: input.entityModule === "products" ? input.entityId : null,
    taxableCents,
    currency: pricing.currency,
  })
  if (!taxLine) return input.result

  const subtotal = taxLine.includedInPrice
    ? Math.max(0, taxableCents - taxLine.amountCents)
    : taxableCents
  const total = taxLine.includedInPrice ? taxableCents : taxableCents + taxLine.amountCents
  const adjusted = {
    ...pricing,
    base_amount: subtotal,
    taxes: taxLine.amountCents,
    breakdown: {
      currency: pricing.currency,
      lines: [
        {
          kind: "base" as const,
          label: "Base",
          quantity: 1,
          unitAmount: taxableCents,
          totalAmount: taxableCents,
          taxIncluded: taxLine.includedInPrice,
        },
      ],
      taxes: [
        {
          code: taxLine.code ?? "tax",
          label: taxLine.name,
          rate: (taxLine.rateBasisPoints ?? 0) / 10_000,
          amount: taxLine.amountCents,
          base: subtotal,
          includedInPrice: taxLine.includedInPrice,
          scope: taxLine.scope,
        },
      ],
      subtotal,
      taxTotal: taxLine.amountCents,
      total,
    },
  }
  await input.persistPricing(input.result.quoteId, adjusted)
  return { ...input.result, pricing: adjusted }
}

function totalPax(draft: Record<string, unknown> | undefined): number | null {
  const pax = asRecord(asRecord(draft?.configure)?.pax)
  if (!pax) return null
  const total = Object.values(pax).reduce(
    (sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? value : 0),
    0,
  )
  return total > 0 ? total : null
}

function sourcedBookingTitle(payloadValue: unknown, fallback: string): string {
  const payload = asRecord(payloadValue)
  const content = asRecord(payload?.content)
  return (
    stringValue(asRecord(content?.product)?.name) ??
    stringValue(asRecord(content?.hotel)?.name) ??
    stringValue(asRecord(content?.cruise)?.name) ??
    stringValue(payload?.name) ??
    fallback
  )
}

function dateString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : null
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
