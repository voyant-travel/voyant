import { queryOptions } from "@tanstack/react-query"
import type { ProductDayRecord as ProductDay } from "@voyantjs/products-react"
import { ApiError, api } from "@/lib/api-client"

export type Product = {
  id: string
  name: string
  status: "draft" | "active" | "archived"
  description: string | null
  sellCurrency: string
  sellAmountCents: number | null
  costAmountCents: number | null
  marginPercent: number | null
  personId: string | null
  organizationId: string | null
  startDate: string | null
  endDate: string | null
  pax: number | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type { ProductDayRecord as ProductDay } from "@voyantjs/products-react"

export type DayService = {
  id: string
  dayId: string
  supplierServiceId: string | null
  serviceType: "accommodation" | "transfer" | "experience" | "guide" | "meal" | "other"
  name: string
  description: string | null
  costCurrency: string
  costAmountCents: number
  quantity: number
  sortOrder: number | null
  notes: string | null
  createdAt: string
}

export type ProductVersion = {
  id: string
  productId: string
  versionNumber: number
  authorId: string
  notes: string | null
  createdAt: string
}

export type ProductNote = {
  id: string
  productId: string
  authorId: string
  content: string
  createdAt: string
}

export function getProductQueryOptions(id: string) {
  return {
    queryKey: ["product", id],
    queryFn: () => api.get<{ data: Product }>(`/v1/products/${id}`),
  }
}
export function getProductDaysQueryOptions(id: string) {
  return {
    queryKey: ["product-days", id],
    queryFn: () => api.get<{ data: ProductDay[] }>(`/v1/products/${id}/days`),
  }
}
export function getProductVersionsQueryOptions(id: string) {
  return {
    queryKey: ["product-versions", id],
    queryFn: () => api.get<{ data: ProductVersion[] }>(`/v1/products/${id}/versions`),
  }
}
export function getProductNotesQueryOptions(id: string) {
  return {
    queryKey: ["product-notes", id],
    queryFn: () => api.get<{ data: ProductNote[] }>(`/v1/products/${id}/notes`),
  }
}
export function getProductDayServicesQueryOptions(productId: string, dayId: string) {
  return queryOptions({
    queryKey: ["product-day-services", productId, dayId],
    queryFn: () =>
      api.get<{ data: DayService[] }>(`/v1/products/${productId}/days/${dayId}/services`),
  })
}

export const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  active: "default",
  archived: "secondary",
}

const DEFAULT_NO_VALUE = "—"

export function formatAmount(cents: number | null, currency: string): string {
  if (cents == null) return DEFAULT_NO_VALUE
  return `${(cents / 100).toFixed(2)} ${currency}`
}

export function formatMargin(percent: number | null): string {
  if (percent == null) return DEFAULT_NO_VALUE
  return `${(percent / 100).toFixed(2)}%`
}

// ─────────────────────────────────────────────────────────────────────────────
// Sourced content (catalog-sourced-content §3.3) — owned products return
// 404 from /v1/admin/products/:id/content; the query catches that and
// returns null so the UI conditionally renders without a TanStack Query
// error state.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductSourcedContentResponse {
  data: {
    content: {
      product: {
        id: string
        name: string
        description?: string | null
        highlights?: string[]
        hero_image_url?: string | null
        duration_days?: number | null
        sell_currency?: string | null
        supplier?: string | null
        country?: string | null
      }
      options: Array<{ id: string; name: string; description?: string | null }>
      days: Array<{
        day_number: number
        title?: string | null
        description?: string | null
        location?: string | null
      }>
      media: Array<{ url: string; type: string; caption?: string | null }>
      policies: Array<{ kind: string; body: string }>
    }
    served_locale: string
    match_kind: "exact" | "language_match" | "fallback_chain" | "any"
    source: "sourced-cache" | "sourced-fresh" | "synthesized" | "owned"
    served_stale: boolean
    synthesized: boolean
    machine_translated: boolean
  }
}

export function getProductSourcedContentQueryOptions(productId: string) {
  return queryOptions({
    queryKey: ["products", productId, "sourced-content"] as const,
    queryFn: async (): Promise<ProductSourcedContentResponse | null> => {
      try {
        return await api.get<ProductSourcedContentResponse>(
          `/v1/admin/products/${productId}/content`,
        )
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 503)) {
          return null
        }
        throw err
      }
    },
    staleTime: 60_000,
  })
}
