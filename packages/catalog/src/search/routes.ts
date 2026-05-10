import { parseJsonBody } from "@voyantjs/hono"
import type { HonoModule } from "@voyantjs/hono/module"
import type { Context, Hono as HonoApp } from "hono"
import { Hono } from "hono"
import { z } from "zod"

import type {
  IndexerAdapter,
  IndexerSlice,
  SearchFilter,
  SearchMode,
  SearchRequest,
  SearchResults,
} from "../indexer/contract.js"

const searchModeSchema = z.enum(["keyword", "semantic", "hybrid"])
const searchFilterSchema: z.ZodType<SearchFilter> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal("eq"),
      field: z.string().min(1),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
    z.object({
      kind: z.literal("in"),
      field: z.string().min(1),
      values: z.array(z.union([z.string(), z.number()])),
    }),
    z.object({
      kind: z.literal("range"),
      field: z.string().min(1),
      gte: z.number().optional(),
      lte: z.number().optional(),
    }),
    z.object({
      kind: z.literal("and"),
      clauses: z.array(searchFilterSchema),
    }),
    z.object({
      kind: z.literal("or"),
      clauses: z.array(searchFilterSchema),
    }),
  ]),
)

const catalogSearchBodySchema = z.object({
  vertical: z.string().min(1).optional(),
  query: z.string().optional(),
  mode: searchModeSchema.optional(),
  filters: z.array(searchFilterSchema).optional(),
  facets: z
    .array(z.object({ field: z.string().min(1), limit: z.number().int().positive().optional() }))
    .optional(),
  pagination: z
    .object({
      limit: z.number().int().positive().optional(),
      cursor: z.string().optional(),
    })
    .optional(),
  alpha: z.number().optional(),
  distance_threshold: z.number().optional(),
  query_embedding: z.array(z.number()).optional(),
  market: z.string().min(1).optional(),
  locale: z.string().min(1).optional(),
})

export type CatalogSearchBody = z.infer<typeof catalogSearchBodySchema>

export interface CatalogSearchRuntime {
  indexer?: IndexerAdapter
  /**
   * Template-owned embedding provider. Kept intentionally unknown so
   * `@voyantjs/catalog` does not depend on `@voyantjs/catalog-rag`.
   */
  embeddings?: unknown
  defaultScope: {
    locale: string
    audience: IndexerSlice["audience"]
    market: string
  }
}

export interface CatalogSearchExecuteInput {
  c: Context
  adapter: IndexerAdapter
  embeddings?: unknown
  slice: IndexerSlice
  request: SearchRequest
}

export interface CatalogSearchFallbackInput extends CatalogSearchExecuteInput {
  error: unknown
}

export interface CatalogSearchRoutesOptions {
  resolveRuntime(c: Context): CatalogSearchRuntime
  /**
   * Optional semantic/hybrid executor. Templates that use
   * `@voyantjs/catalog-rag` should pass `executeSemanticSearch` here.
   * Without this hook, the route delegates directly to `adapter.search`.
   */
  executeSearch?(input: CatalogSearchExecuteInput): Promise<SearchResults>
  /**
   * Retry semantic/hybrid requests as keyword when embedding generation or
   * vector search fails. Defaults to true to preserve the operator template's
   * "best available search mode" behavior.
   */
  fallbackToKeywordOnSearchError?: boolean | ((input: CatalogSearchFallbackInput) => boolean)
  /** Public route audience. Defaults to the customer projection. */
  publicAudience?: IndexerSlice["audience"]
  /** Admin route audience. Defaults to the runtime default scope audience. */
  adminAudience?: IndexerSlice["audience"]
  indexerUnavailableMessage?: string
}

export type CatalogSearchSurface = "admin" | "public"

export interface CatalogSearchRoutesWithSurfaceOptions extends CatalogSearchRoutesOptions {
  surface: CatalogSearchSurface
}

export function createCatalogSearchRoutes(options: CatalogSearchRoutesWithSurfaceOptions): HonoApp {
  return new Hono().post("/search", async (c) => handleSearch(c, options))
}

export function createCatalogSearchHonoModule(options: CatalogSearchRoutesOptions): HonoModule {
  return {
    module: { name: "catalog" },
    adminRoutes: createCatalogSearchRoutes({ ...options, surface: "admin" }),
    publicRoutes: createCatalogSearchRoutes({ ...options, surface: "public" }),
  }
}

export function mountCatalogSearchRoutes(hono: HonoApp, options: CatalogSearchRoutesOptions): void {
  hono.route("/v1/admin/catalog", createCatalogSearchRoutes({ ...options, surface: "admin" }))
  hono.route("/v1/public/catalog", createCatalogSearchRoutes({ ...options, surface: "public" }))
}

async function handleSearch(
  c: Context,
  options: CatalogSearchRoutesWithSurfaceOptions,
): Promise<Response> {
  const body = await parseJsonBody(c, catalogSearchBodySchema)

  if (!body.vertical) return c.json({ error: "vertical is required" }, 400)

  const runtime = options.resolveRuntime(c)
  const indexer = runtime.indexer
  if (!indexer) {
    return c.json(
      {
        error:
          options.indexerUnavailableMessage ??
          "Search indexer is not configured (missing TYPESENSE_HOST)",
      },
      503,
    )
  }

  const requestedMode = body.mode ?? "hybrid"
  const mode =
    shouldUseEmbeddingMode(requestedMode) && !runtime.embeddings && !body.query_embedding
      ? "keyword"
      : requestedMode
  const slice: IndexerSlice = {
    vertical: body.vertical,
    locale: body.locale ?? runtime.defaultScope.locale,
    audience: resolveAudience(options, runtime),
    market: body.market ?? runtime.defaultScope.market,
  }
  const request = buildSearchRequest(body, mode)

  try {
    const { results, responseMode } = await executeWithKeywordFallback(c, options, {
      adapter: indexer,
      embeddings: runtime.embeddings,
      slice,
      request,
    })
    return c.json({
      vertical: body.vertical,
      mode: responseMode,
      total: results.total,
      hits: results.hits,
      facets: results.facets ?? {},
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
}

function resolveAudience(
  options: CatalogSearchRoutesWithSurfaceOptions,
  runtime: CatalogSearchRuntime,
): IndexerSlice["audience"] {
  if (options.surface === "public") return options.publicAudience ?? "customer"
  return options.adminAudience ?? runtime.defaultScope.audience
}

function buildSearchRequest(body: CatalogSearchBody, mode: SearchMode): SearchRequest {
  return {
    query: body.query ?? "",
    mode,
    filters: body.filters,
    facets: body.facets,
    pagination: body.pagination,
    alpha: body.alpha,
    distance_threshold: body.distance_threshold,
    query_embedding: body.query_embedding,
  }
}

async function executeWithKeywordFallback(
  c: Context,
  options: CatalogSearchRoutesWithSurfaceOptions,
  input: Omit<CatalogSearchExecuteInput, "c">,
): Promise<{ results: SearchResults; responseMode: SearchMode }> {
  const executeSearch = options.executeSearch ?? defaultExecuteSearch
  const executeInput = { c, ...input }
  try {
    return {
      results: await executeSearch(executeInput),
      responseMode: input.request.mode,
    }
  } catch (error) {
    if (!shouldRetryAsKeyword(options, executeInput, error)) throw error

    const keywordRequest: SearchRequest = {
      ...input.request,
      mode: "keyword",
      query_embedding: undefined,
    }
    return {
      results: await executeSearch({ ...executeInput, request: keywordRequest }),
      responseMode: "keyword",
    }
  }
}

function shouldRetryAsKeyword(
  options: CatalogSearchRoutesWithSurfaceOptions,
  input: CatalogSearchExecuteInput,
  error: unknown,
): boolean {
  if (!shouldUseEmbeddingMode(input.request.mode)) return false
  const fallback = options.fallbackToKeywordOnSearchError ?? true
  if (typeof fallback === "function") return fallback({ ...input, error })
  return fallback
}

function shouldUseEmbeddingMode(mode: SearchMode): boolean {
  return mode === "semantic" || mode === "hybrid"
}

async function defaultExecuteSearch(input: CatalogSearchExecuteInput): Promise<SearchResults> {
  return input.adapter.search(input.slice, input.request)
}
