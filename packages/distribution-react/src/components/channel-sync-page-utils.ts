import { useEffect, useRef, useState } from "react"

import type { VoyantFetcher } from "../index.js"

// Types matching the admin API at distribution/src/channel-push/admin-routes.ts

export type PushStatus = "pending" | "ok" | "failed" | "compensated"

export interface ChannelBookingLinkRow {
  link: {
    id: string
    channelId: string
    bookingId: string
    bookingItemId: string | null
    sourceKind: string | null
    sourceConnectionId: string | null
    pushStatus: PushStatus | string
    pushAttempts: number
    lastPushAt: string | null
    lastError: string | null
    externalBookingId: string | null
    externalReference: string | null
    externalStatus: string | null
    createdAt: string
  }
  channelName: string
  channelKind: string
}

export interface LinksResponse {
  data: ChannelBookingLinkRow[]
  counts: Record<string, number>
}

export interface DeliveryRow {
  id: string
  sourceModule: string
  sourceEvent: string
  sourceEntityId: string | null
  targetUrl: string
  targetKind: string | null
  targetRef: string | null
  requestMethod: string
  responseStatus: number | null
  responseBodyExcerpt: string | null
  attemptNumber: number
  status: string
  errorClass: string | null
  errorMessage: string | null
  durationMs: number | null
  createdAt: string
}

export interface DeliveriesResponse {
  data: DeliveryRow[]
}

export interface ThrottlingRow {
  channelId: string | null
  count: number
}

export interface ThrottlingResponse {
  data: ThrottlingRow[]
  sinceMs: number
}

export interface ReconcilerResult {
  scanned: number
  triggered: number
}

export interface BookingRecord {
  id: string
  bookingNumber: string
  status: string
}

export interface BookingsResponse {
  data: BookingRecord[]
}

export interface ChannelRecord {
  id: string
  name: string
  kind: string
  status: string
}

export interface ChannelsResponse {
  data: ChannelRecord[]
}

export interface ChannelSyncPageProps {
  baseUrl?: string
  fetcher?: VoyantFetcher
  className?: string
}

export const channelPushAdminPaths = {
  links: "/v1/admin/distribution/links",
  throttling: "/v1/admin/distribution/throttling",
  deliveries: "/v1/admin/distribution/deliveries",
  retry: (bookingId: string) => `/v1/admin/distribution/retry/${encodeURIComponent(bookingId)}`,
  reconcile: (flow: "bookings" | "availability" | "content") =>
    `/v1/admin/distribution/reconcile/${flow}`,
} as const

// Fetch helpers

export async function fetchJson<T>(
  path: string,
  options: { baseUrl: string; fetcher: VoyantFetcher },
  init?: RequestInit,
): Promise<T> {
  const res = await options.fetcher(joinUrl(options.baseUrl, path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const text = await res.text()
  const body = text
    ? (JSON.parse(text) as { data?: T; error?: string })
    : ({} as { error?: string })
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return body as T
}

export const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> =
  {
    pending: "secondary",
    ok: "default",
    failed: "destructive",
    compensated: "outline",
  }

export const STATUS_TILES: ReadonlyArray<{
  key: PushStatus
  tone: "default" | "secondary" | "destructive" | "outline"
}> = [
  { key: "pending", tone: "secondary" },
  { key: "ok", tone: "default" },
  { key: "failed", tone: "destructive" },
  { key: "compensated", tone: "outline" },
]

export const LINKS_REFETCH_MS = 15_000
export const THROTTLING_REFETCH_MS = 60_000

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setDebounced(value), delayMs)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [value, delayMs])
  return debounced
}

export function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

export function formatChannelKind(kind: string): string {
  return kind.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
}

export function formatShortDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const min = Math.round(seconds / 60)
  if (min < 60) return `${min}m`
  const hours = Math.round(min / 60)
  return `${hours}h`
}

export function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function formatTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined ? "" : String(value)
  })
}
