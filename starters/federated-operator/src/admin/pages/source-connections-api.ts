import { getApiUrl } from "@/lib/env"
import { federatedOperatorFetcher } from "@/lib/voyant-fetcher"

export type SourceConnectionMode = "native" | "mirrored" | "external-live" | "hybrid"
export type SourceConnectionStatus =
  | "draft"
  | "active"
  | "paused"
  | "degraded"
  | "disconnecting"
  | "disconnected"
export type SourceConnectionHealth = "unknown" | "healthy" | "degraded" | "failing"

export interface SourceConnectionRow {
  id: string
  sourceKind: string
  displayName: string
  capabilityScope: string
  sourceOfTruthMode: SourceConnectionMode
  status: SourceConnectionStatus
  credentialRef: string | null
  credentialRefVersion: string | null
  sourceAccountId: string | null
  grantedScopes: string[]
  capabilities: Array<{
    capability: string
    state: "supported" | "unsupported" | "unknown"
    notes?: string
  }>
  healthStatus: SourceConnectionHealth
  lastCheckedAt: string | null
  lastHealthyAt: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  retryAfterAt: string | null
  rateLimitState: Record<string, unknown> | null
  cursorState: Record<string, unknown> | null
  disconnectBehavior: string[]
  disconnectReason: string | null
  disconnectRequestedAt: string | null
  disconnectedAt: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface SourceConnectionListResponse {
  data: SourceConnectionRow[]
  total: number
  limit: number
  offset: number
}

export interface SourceConnectionDetailResponse {
  data: SourceConnectionRow
}

export const sourceConnectionsKey = ["source-connections"] as const

export const initialDraft = {
  displayName: "",
  sourceKind: "crm:hubspot",
  capabilityScope: "people",
  sourceOfTruthMode: "mirrored" as SourceConnectionMode,
  credentialRef: "",
  sourceAccountId: "",
  grantedScopes: "",
  capabilities: "delta sync, webhook delivery",
}

export async function fetchSourceConnections(): Promise<SourceConnectionListResponse> {
  const res = await federatedOperatorFetcher(`${getApiUrl()}/v1/admin/source-connections`)
  if (!res.ok) throw new Error(`source connections failed: ${res.status}`)
  return (await res.json()) as SourceConnectionListResponse
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await federatedOperatorFetcher(`${getApiUrl()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const message = await res.text()
    throw new Error(message || `request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
