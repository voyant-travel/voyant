/**
 * Template-local promotions client + React Query options.
 *
 * Mirrors the legal-react pattern (fetch + Zod + queryOptions factory)
 * but lives in-template for v1 — promotion ops are operator-internal so
 * we don't need a published react companion package yet. If a second
 * template needs this, extract to `@voyantjs/promotions-react`.
 */

import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

import { getApiUrl } from "@/lib/env"

// ---------- Schemas (subset of @voyantjs/promotions/validation) ----------

const audienceSchema = z.enum(["staff", "customer", "partner", "supplier"])

export const promotionalOfferScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("global") }),
  z.object({ kind: z.literal("products"), productIds: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal("categories"), categoryIds: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal("destinations"), destinationIds: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal("markets"), marketIds: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal("audiences"), audiences: z.array(audienceSchema).min(1) }),
])

export type PromotionalOfferScope = z.infer<typeof promotionalOfferScopeSchema>

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
  conditions: z.object({ minPax: z.number().int().positive().optional() }).catchall(z.unknown()),
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

interface ListQuery {
  active?: boolean
  code?: string
  limit?: number
  offset?: number
}

function buildSearch(query: ListQuery): string {
  const params = new URLSearchParams()
  if (query.active !== undefined) params.set("active", String(query.active))
  if (query.code) params.set("code", query.code)
  if (query.limit !== undefined) params.set("limit", String(query.limit))
  if (query.offset !== undefined) params.set("offset", String(query.offset))
  const s = params.toString()
  return s ? `?${s}` : ""
}

async function fetchJson<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init,
  })
  const text = await res.text()
  const body = text ? safeJson(text) : undefined
  if (!res.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : `Promotions API error: ${res.status} ${res.statusText}`
    throw new PromotionsApiError(message, res.status, body)
  }
  return schema.parse(body)
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
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

const promotionsKeys = {
  all: ["promotions"] as const,
  list: (query: ListQuery) => ["promotions", "list", query] as const,
  detail: (id: string) => ["promotions", "detail", id] as const,
}

export function getPromotionsListQueryOptions(query: ListQuery = {}) {
  return queryOptions({
    queryKey: promotionsKeys.list(query),
    queryFn: () =>
      fetchJson(`/v1/admin/promotions${buildSearch(query)}`, { method: "GET" }, listResponseSchema),
  })
}

export function getPromotionByIdQueryOptions(id: string) {
  return queryOptions({
    queryKey: promotionsKeys.detail(id),
    queryFn: () =>
      fetchJson(`/v1/admin/promotions/${id}`, { method: "GET" }, singleResponseSchema).then(
        (r) => r.data,
      ),
  })
}

export function usePromotionsList(query: ListQuery = {}) {
  return useQuery(getPromotionsListQueryOptions(query))
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
  conditions?: { minPax?: number }
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
  return useMutation({
    mutationFn: (input: PromotionInsertInput) =>
      fetchJson(
        "/v1/admin/promotions",
        { method: "POST", body: JSON.stringify(input) },
        singleResponseSchema,
      ).then((r) => r.data),
    onSuccess: () => invalidatePromotions(qc),
  })
}

export function useUpdatePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PromotionUpdateInput }) =>
      fetchJson(
        `/v1/admin/promotions/${id}`,
        { method: "PATCH", body: JSON.stringify(patch) },
        singleResponseSchema,
      ).then((r) => r.data),
    onSuccess: () => invalidatePromotions(qc),
  })
}

export function useArchivePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(
        `/v1/admin/promotions/${id}/archive`,
        { method: "POST" },
        singleResponseSchema,
      ).then((r) => r.data),
    onSuccess: () => invalidatePromotions(qc),
  })
}

export function useDeletePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(
        `/v1/admin/promotions/${id}`,
        { method: "DELETE" },
        z.object({ data: z.object({ id: z.string() }) }),
      ).then((r) => r.data),
    onSuccess: () => invalidatePromotions(qc),
  })
}
