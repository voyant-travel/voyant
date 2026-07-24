import { queryOptions } from "@tanstack/react-query"
import type { ProductRecord } from "../../index.js"
import type { ProductDetailApi, ProductMessagesRoot } from "./host.js"

import type { DepartureSlot } from "./product-departure-dialog.js"
import type { AvailabilityRule } from "./product-schedule-dialog.js"

export type { AvailabilityRule, DepartureSlot, ProductRecord }

export type ProductDay = {
  id: string
  itineraryId: string
  dayNumber: number
  title: string | null
  description: string | null
  location: string | null
  createdAt: string
  updatedAt: string
}

export type DayService = {
  id: string
  dayId: string
  supplierServiceId: string | null
  serviceType: "accommodation" | "transfer" | "experience" | "guide" | "meal" | "other"
  name: string
  description: string | null
  countryCode: string | null
  costCurrency: string
  costAmountCents: number
  quantity: number
  sortOrder: number | null
  notes: string | null
  createdAt: string
}

export type ChannelInfo = {
  id: string
  name: string
  kind: string
  status: string
}

export type ChannelProductMapping = {
  id: string
  channelId: string
  productId: string
  active: boolean
}

export type ProductMediaItem = {
  id: string
  productId: string
  dayId: string | null
  mediaType: "image" | "video" | "document"
  name: string
  url: string
  storageKey: string | null
  mimeType: string | null
  fileSize: number | null
  width: number | null
  height: number | null
  altText: string | null
  sortOrder: number
  isCover: boolean
  isOpenGraph: boolean
  isBrochure: boolean
  isBrochureCurrent: boolean
  brochureVersion: number | null
  createdAt: string
  updatedAt: string
}

export function getProductDetailDaysQueryOptions(api: ProductDetailApi, id: string) {
  return queryOptions({
    queryKey: ["product-days", id],
    queryFn: () => api.get<{ data: ProductDay[] }>(`/v1/admin/products/${id}/days`),
  })
}

export function getProductSlotsQueryOptions(api: ProductDetailApi, id: string) {
  return queryOptions({
    queryKey: ["product-slots", id],
    queryFn: () =>
      api.get<{ data: DepartureSlot[] }>(
        `/v1/admin/operations/availability/slots?productId=${id}&limit=25`,
      ),
  })
}

export function getProductRulesQueryOptions(api: ProductDetailApi, id: string) {
  return queryOptions({
    queryKey: ["product-rules", id],
    queryFn: () =>
      api.get<{ data: AvailabilityRule[] }>(
        `/v1/admin/operations/availability/rules?productId=${id}&limit=50`,
      ),
  })
}

export function getProductDetailDayServicesQueryOptions(
  api: ProductDetailApi,
  productId: string,
  dayId: string,
) {
  return queryOptions({
    queryKey: ["product-day-services", productId, dayId],
    queryFn: () =>
      api.get<{ data: DayService[] }>(`/v1/admin/products/${productId}/days/${dayId}/services`),
  })
}

export function getChannelsQueryOptions(api: ProductDetailApi) {
  return queryOptions({
    queryKey: ["channels"],
    queryFn: () => api.get<{ data: ChannelInfo[] }>("/v1/admin/distribution/channels?limit=25"),
  })
}

export function getProductChannelMappingsQueryOptions(api: ProductDetailApi, id: string) {
  return queryOptions({
    queryKey: ["product-channel-mappings", id],
    queryFn: () =>
      api.get<{ data: ChannelProductMapping[] }>(
        `/v1/admin/distribution/product-mappings?productId=${id}&limit=25`,
      ),
  })
}

export function getProductDetailMediaQueryOptions(api: ProductDetailApi, id: string) {
  return queryOptions({
    queryKey: ["product-media", id],
    queryFn: () =>
      api.get<{ data: ProductMediaItem[]; total: number }>(
        `/v1/admin/products/${id}/media?limit=50`,
      ),
  })
}

export function getProductDayMediaQueryOptions(
  api: ProductDetailApi,
  productId: string,
  dayId: string,
) {
  return queryOptions({
    queryKey: ["day-media", productId, dayId],
    queryFn: () =>
      api.get<{ data: ProductMediaItem[]; total: number }>(
        `/v1/admin/products/${productId}/days/${dayId}/media?limit=50`,
      ),
  })
}

export const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  active: "default",
  archived: "secondary",
}

export const slotStatusVariant: Record<
  DepartureSlot["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  open: "default",
  closed: "secondary",
  sold_out: "outline",
  cancelled: "destructive",
}

export function formatAmount(cents: number | null, currency: string): string {
  if (cents == null) return "-"
  return `${(cents / 100).toFixed(2)} ${currency}`
}

export function formatMargin(percent: number | null): string {
  if (percent == null) return "-"
  return `${percent.toFixed(0)}%`
}

export function formatSlotTime(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`
}

export function formatSlotDate(iso: string): string {
  const date = new Date(iso)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
}

export function formatDuration(slot: DepartureSlot): string {
  if (slot.nights != null || slot.days != null) {
    const parts: string[] = []
    if (slot.days != null) parts.push(`${slot.days} day${slot.days === 1 ? "" : "s"}`)
    if (slot.nights != null) parts.push(`${slot.nights} night${slot.nights === 1 ? "" : "s"}`)
    return parts.join(" / ")
  }
  if (!slot.endsAt) return "-"
  const startMs = new Date(slot.startsAt).getTime()
  const endMs = new Date(slot.endsAt).getTime()
  const diffMs = endMs - startMs
  if (diffMs <= 0) return "-"
  const hours = diffMs / 3_600_000
  if (hours < 24) return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`
  const startDate = formatSlotDate(slot.startsAt)
  const endDate = formatSlotDate(slot.endsAt)
  const nights = Math.round(
    (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) /
      86_400_000,
  )
  return `${nights} night${nights === 1 ? "" : "s"}`
}

export function getProductStatusLabel(
  status: ProductRecord["status"],
  messages: ProductMessagesRoot,
): string {
  switch (status) {
    case "draft":
      return messages.products.core.statusDraft
    case "active":
      return messages.products.core.statusActive
    case "archived":
      return messages.products.core.statusArchived
    default:
      return status
  }
}

export function getProductBookingModeLabel(
  bookingMode: ProductRecord["bookingMode"],
  messages: ProductMessagesRoot,
): string {
  switch (bookingMode) {
    case "date":
      return messages.products.core.bookingModeDate
    case "date_time":
      return messages.products.core.bookingModeDateTime
    case "open":
      return messages.products.core.bookingModeOpen
    case "stay":
      return messages.products.core.bookingModeStay
    case "transfer":
      return messages.products.core.bookingModeTransfer
    case "itinerary":
      return messages.products.core.bookingModeItinerary
    case "other":
      return messages.products.core.bookingModeOther
    default:
      return bookingMode
  }
}

/**
 * Pricing-basis hint for a booking mode (e.g. "per person", "rooms & nights").
 * Returns "" for modes without a meaningful basis. Shown only as secondary text
 * inside the booking-mode picker, never in the table column or detail chip.
 */
export function getProductBookingModeBasis(
  bookingMode: ProductRecord["bookingMode"],
  messages: ProductMessagesRoot,
): string {
  switch (bookingMode) {
    case "date":
      return messages.products.core.bookingModeDateBasis
    case "date_time":
      return messages.products.core.bookingModeDateTimeBasis
    case "open":
      return messages.products.core.bookingModeOpenBasis
    case "stay":
      return messages.products.core.bookingModeStayBasis
    case "transfer":
      return messages.products.core.bookingModeTransferBasis
    case "itinerary":
      return messages.products.core.bookingModeItineraryBasis
    case "other":
      return messages.products.core.bookingModeOtherBasis
    default:
      return ""
  }
}

export function getDepartureStatusLabel(
  status: DepartureSlot["status"],
  messages: ProductMessagesRoot,
): string {
  switch (status) {
    case "open":
      return messages.products.core.departureStatusOpen
    case "closed":
      return messages.products.core.departureStatusClosed
    case "sold_out":
      return messages.products.core.departureStatusSoldOut
    case "cancelled":
      return messages.products.core.departureStatusCancelled
    default:
      return status
  }
}

export function formatCapacityLabel(slot: DepartureSlot, messages: ProductMessagesRoot): string {
  if (slot.unlimited) return messages.products.core.unlimitedCapacity
  if (slot.initialPax == null) return messages.products.core.noValue
  const remaining = slot.remainingPax ?? slot.initialPax
  return `${remaining} / ${slot.initialPax}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Sourced content (catalog-sourced-content §3.3) — owned products return
// 404 from /v1/admin/products/:id/content; the query options helper
// catches that and returns null so the UI can render conditionally
// without a TanStack Query error state.
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
        hero_image_url?: string | null
      }>
      media: Array<{ url: string; type: string; caption?: string | null }>
      policies: Array<{ kind: string; body: string }>
      departures?: Array<{
        id: string
        starts_at: string
        ends_at?: string | null
        status?: string | null
        capacity?: number | null
        remaining?: number | null
        lowest_price_cents?: number | null
        currency?: string | null
        note?: string | null
      }>
    }
    served_locale: string
    match_kind: "exact" | "language_match" | "fallback_chain" | "any"
    source: "sourced-cache" | "sourced-fresh" | "synthesized" | "owned"
    served_stale: boolean
    synthesized: boolean
    machine_translated: boolean
  }
}
