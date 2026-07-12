"use client"

import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  type PromotionalOfferApplicationMode,
  type PromotionalOfferConditions,
  type PromotionalOfferListStatus,
  type PromotionalOfferScope,
  type PromotionalOfferScopeKind,
  promotionalOfferConditionsSchema,
  promotionalOfferScopeSchema,
} from "@voyant-travel/commerce/validation"
import {
  defaultFetcher,
  useVoyantReactContext,
  type VoyantFetcher,
  type VoyantReactContextValue,
  VoyantReactProvider,
  type VoyantReactProviderProps,
} from "@voyant-travel/react"
import { z } from "zod"

// ---------- Provider ----------

export {
  defaultFetcher,
  useVoyantReactContext as useVoyantPromotionsContext,
  type VoyantFetcher,
  type VoyantReactContextValue as VoyantPromotionsContextValue,
  VoyantReactProvider as VoyantPromotionsProvider,
  type VoyantReactProviderProps as VoyantPromotionsProviderProps,
}

// ---------- Schemas ----------

export {
  type PromotionalOfferApplicationMode,
  type PromotionalOfferConditions,
  type PromotionalOfferListStatus,
  type PromotionalOfferScope,
  type PromotionalOfferScopeKind,
  promotionalOfferConditionsSchema,
  promotionalOfferScopeSchema,
} from "@voyant-travel/commerce/validation"

const promotionalOfferRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  discountType: z.enum(["percentage", "fixed_amount"]),
  discountPercent: z.string().nullable(),
  discountAmountCents: z.number().nullable(),
  currency: z.string().nullable(),
  scope: promotionalOfferScopeSchema,
  conditions: promotionalOfferConditionsSchema,
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  code: z.string().nullable(),
  stackable: z.boolean(),
  active: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PromotionalOfferRecord = z.infer<typeof promotionalOfferRecordSchema>

const listResponseSchema = z.object({
  data: z.array(promotionalOfferRecordSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
})

const singleResponseSchema = z.object({ data: promotionalOfferRecordSchema })

// ---------- Fetch helpers ----------

export interface PromotionsListQuery {
  active?: boolean
  code?: string
  search?: string
  applicationMode?: PromotionalOfferApplicationMode
  status?: PromotionalOfferListStatus
  scopeKind?: PromotionalOfferScopeKind
  validFrom?: string
  validUntil?: string
  limit?: number
  offset?: number
}

export interface PromotionsClientOptions {
  baseUrl: string
  fetcher: VoyantFetcher
}

function buildSearch(query: PromotionsListQuery): string {
  const params = new URLSearchParams()
  if (query.active !== undefined) params.set("active", String(query.active))
  if (query.code) params.set("code", query.code)
  if (query.search) params.set("search", query.search)
  if (query.applicationMode) params.set("applicationMode", query.applicationMode)
  if (query.status) params.set("status", query.status)
  if (query.scopeKind) params.set("scopeKind", query.scopeKind)
  if (query.validFrom) params.set("validFrom", query.validFrom)
  if (query.validUntil) params.set("validUntil", query.validUntil)
  if (query.limit !== undefined) params.set("limit", String(query.limit))
  if (query.offset !== undefined) params.set("offset", String(query.offset))
  const s = params.toString()
  return s ? `?${s}` : ""
}

export async function fetchPromotionsJson<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  client: PromotionsClientOptions,
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await client.fetcher(joinUrl(client.baseUrl, path), { ...init, headers })
  const body = await safeJson(response)
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : `Promotions API error: ${response.status} ${response.statusText}`
    throw new PromotionsApiError(message, response.status, body)
  }
  return schema.parse(body)
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const resolvedBaseUrl = resolveBaseUrl(baseUrl)
  const trimmedBase = resolvedBaseUrl.endsWith("/") ? resolvedBaseUrl.slice(0, -1) : resolvedBaseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

function resolveBaseUrl(baseUrl: string): string {
  if (baseUrl.trim()) return baseUrl

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`
  }

  return "http://localhost:3300/api"
}

export function createPromotionsClientOptions(
  client?: Partial<PromotionsClientOptions>,
): PromotionsClientOptions {
  return {
    baseUrl: client?.baseUrl ?? "",
    fetcher: client?.fetcher ?? defaultFetcher,
  }
}

export class PromotionsApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "PromotionsApiError"
    this.status = status
    this.body = body
  }
}

// ---------- Query keys + options ----------

export const promotionsKeys = {
  all: ["promotions"] as const,
  list: (query: PromotionsListQuery) => ["promotions", "list", query] as const,
  detail: (id: string) => ["promotions", "detail", id] as const,
}

export function getPromotionsListQueryOptions(
  query: PromotionsListQuery = {},
  client: PromotionsClientOptions = createPromotionsClientOptions(),
) {
  return queryOptions({
    queryKey: promotionsKeys.list(query),
    queryFn: () =>
      fetchPromotionsJson(
        `/v1/admin/promotions${buildSearch(query)}`,
        { method: "GET" },
        listResponseSchema,
        client,
      ),
  })
}

export function getPromotionByIdQueryOptions(
  id: string,
  client: PromotionsClientOptions = createPromotionsClientOptions(),
) {
  return queryOptions({
    queryKey: promotionsKeys.detail(id),
    queryFn: () =>
      fetchPromotionsJson(
        `/v1/admin/promotions/${id}`,
        { method: "GET" },
        singleResponseSchema,
        client,
      ).then((r) => r.data),
  })
}

export function usePromotionsList(query: PromotionsListQuery = {}) {
  const client = useVoyantReactContext()
  return useQuery(getPromotionsListQueryOptions(query, client))
}

// ---------- Mutations ----------

export interface PromotionInsertInput {
  name: string
  slug: string
  description?: string | null
  discountType: "percentage" | "fixed_amount"
  discountPercent?: number | null
  discountAmountCents?: number | null
  currency?: string | null
  scope: PromotionalOfferScope
  conditions?: PromotionalOfferConditions
  validFrom?: string | null
  validUntil?: string | null
  code?: string | null
  stackable?: boolean
  active?: boolean
}

export type PromotionUpdateInput = Partial<PromotionInsertInput>

function invalidatePromotions(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({ queryKey: promotionsKeys.all })
}

export function useCreatePromotion() {
  const qc = useQueryClient()
  const client = useVoyantReactContext()
  return useMutation({
    mutationFn: (input: PromotionInsertInput) =>
      fetchPromotionsJson(
        "/v1/admin/promotions",
        { method: "POST", body: JSON.stringify(input) },
        singleResponseSchema,
        client,
      ).then((r) => r.data),
    onSuccess: () => invalidatePromotions(qc),
  })
}

export function useUpdatePromotion() {
  const qc = useQueryClient()
  const client = useVoyantReactContext()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PromotionUpdateInput }) =>
      fetchPromotionsJson(
        `/v1/admin/promotions/${id}`,
        { method: "PATCH", body: JSON.stringify(patch) },
        singleResponseSchema,
        client,
      ).then((r) => r.data),
    onSuccess: () => invalidatePromotions(qc),
  })
}

export function useArchivePromotion() {
  const qc = useQueryClient()
  const client = useVoyantReactContext()
  return useMutation({
    mutationFn: (id: string) =>
      fetchPromotionsJson(
        `/v1/admin/promotions/${id}/archive`,
        { method: "POST" },
        singleResponseSchema,
        client,
      ).then((r) => r.data),
    onSuccess: () => invalidatePromotions(qc),
  })
}

export function useDeletePromotion() {
  const qc = useQueryClient()
  const client = useVoyantReactContext()
  return useMutation({
    mutationFn: (id: string) =>
      fetchPromotionsJson(
        `/v1/admin/promotions/${id}`,
        { method: "DELETE" },
        z.object({ data: z.object({ id: z.string() }) }),
        client,
      ).then((r) => r.data),
    onSuccess: () => invalidatePromotions(qc),
  })
}
