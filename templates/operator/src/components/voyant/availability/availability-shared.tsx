import {
  type AvailabilityCloseoutRow,
  type AvailabilityPickupPointRow,
  type AvailabilityRuleRow,
  type AvailabilitySlotRow,
  type AvailabilityStartTimeRow,
  booleanOptions,
  defaultFetcher,
  formatDateTime,
  formatSelectionLabel,
  getCloseoutsQueryOptions as getCloseoutsQueryOptionsBase,
  getPickupPointsQueryOptions as getPickupPointsQueryOptionsBase,
  getProductsQueryOptions as getProductsQueryOptionsBase,
  getRulesQueryOptions as getRulesQueryOptionsBase,
  getSlotsQueryOptions as getSlotsQueryOptionsBase,
  getStartTimesQueryOptions as getStartTimesQueryOptionsBase,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  type ProductOption,
  productNameById,
  slotStatusOptions,
  toIsoDateTime,
  toLocalDateTimeInput,
} from "@voyantjs/availability-react"

export {
  availabilityCloseoutColumns as closeoutColumns,
  availabilityPickupPointColumns as pickupPointColumns,
  availabilityRuleColumns as ruleColumns,
  availabilitySlotColumns as slotColumns,
  availabilityStartTimeColumns as startTimeColumns,
  formatLocalizedSelectionLabel,
  getSlotStatusLabel,
} from "@voyantjs/availability-ui"

import { getApiUrl } from "@/lib/env"

export type BatchMutationResponse<T = unknown> = {
  data?: T[]
  deletedIds?: string[]
  total: number
  succeeded: number
  failed: Array<{ id: string; error: string }>
}

const client = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

export type {
  AvailabilityCloseoutRow,
  AvailabilityPickupPointRow,
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  AvailabilityStartTimeRow,
  ProductOption,
}
export {
  booleanOptions,
  formatDateTime,
  formatSelectionLabel,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  productNameById,
  slotStatusOptions,
  toIsoDateTime,
  toLocalDateTimeInput,
}

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
