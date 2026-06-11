import {
  getCloseoutsQueryOptions as getCloseoutsQueryOptionsBase,
  getPickupPointsQueryOptions as getPickupPointsQueryOptionsBase,
  getProductsQueryOptions as getProductsQueryOptionsBase,
  getRulesQueryOptions as getRulesQueryOptionsBase,
  getSlotsQueryOptions as getSlotsQueryOptionsBase,
  getStartTimesQueryOptions as getStartTimesQueryOptionsBase,
} from "@voyantjs/availability-react"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

/**
 * Envelope of the availability `batch-update` / `batch-delete` endpoints.
 * App-local: `@voyantjs/availability-react` has no batch mutation client yet,
 * so the availability page wrapper calls them through the app api client.
 */
export type BatchMutationResponse<T = unknown> = {
  data?: T[]
  deletedIds?: string[]
  total: number
  succeeded: number
  failed: Array<{ id: string; error: string }>
}

// operatorFetcher so SSR loaders forward the request cookie.
const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

export function getAvailabilityProductsQueryOptions(filters?: {
  search?: string
  limit?: number
  offset?: number
}) {
  return getProductsQueryOptionsBase(client, {
    limit: filters?.limit ?? 25,
    offset: filters?.offset ?? 0,
    search: filters?.search,
  })
}

export function getAvailabilityRulesQueryOptions() {
  return getRulesQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getAvailabilityStartTimesQueryOptions() {
  return getStartTimesQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getAvailabilitySlotsQueryOptions() {
  return getSlotsQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getAvailabilityCloseoutsQueryOptions() {
  return getCloseoutsQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getAvailabilityPickupPointsQueryOptions() {
  return getPickupPointsQueryOptionsBase(client, { limit: 25, offset: 0 })
}
