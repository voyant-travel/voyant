import { queryOptions } from "@tanstack/react-query"
import type { ProductDayRecord as ProductDay } from "@voyantjs/products-react"
import { api } from "@/lib/api-client"

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
