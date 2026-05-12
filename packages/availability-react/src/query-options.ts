"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseCloseoutsOptions } from "./hooks/use-closeouts.js"
import type { UsePickupPointsOptions } from "./hooks/use-pickup-points.js"
import type { UseProductsOptions } from "./hooks/use-products.js"
import type { UseRulesOptions } from "./hooks/use-rules.js"
import type { UseSlotsOptions } from "./hooks/use-slots.js"
import type { UseStartTimesOptions } from "./hooks/use-start-times.js"
import { availabilityQueryKeys } from "./query-keys.js"
import {
  availabilityCloseoutListResponse,
  availabilityPickupPointListResponse,
  availabilityRuleListResponse,
  availabilitySlotAssignmentListResponse,
  availabilitySlotListResponse,
  availabilitySlotPickupListResponse,
  availabilitySlotSingleResponse,
  availabilityStartTimeListResponse,
  bookingSummaryListResponse,
  productListResponse,
  productSingleResponse,
  resourceSummaryListResponse,
  slotAllocationManifestResponse,
  slotUnitAvailabilityListResponse,
} from "./schemas.js"

function appendPagination(params: URLSearchParams, filters: { limit?: number; offset?: number }) {
  if (filters.limit !== undefined) params.set("limit", String(filters.limit))
  if (filters.offset !== undefined) params.set("offset", String(filters.offset))
}

export function getProductsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseProductsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: availabilityQueryKeys.productsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(`/v1/products${qs ? `?${qs}` : ""}`, productListResponse, client)
    },
  })
}

export function getRulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseRulesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: availabilityQueryKeys.rulesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/availability/rules${qs ? `?${qs}` : ""}`,
        availabilityRuleListResponse,
        client,
      )
    },
  })
}

export function getStartTimesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseStartTimesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: availabilityQueryKeys.startTimesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/availability/start-times${qs ? `?${qs}` : ""}`,
        availabilityStartTimeListResponse,
        client,
      )
    },
  })
}

export function getSlotsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseSlotsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: availabilityQueryKeys.slotsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      if (filters.availabilityRuleId) params.set("availabilityRuleId", filters.availabilityRuleId)
      if (filters.startTimeId) params.set("startTimeId", filters.startTimeId)
      if (filters.status) params.set("status", filters.status)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/availability/slots${qs ? `?${qs}` : ""}`,
        availabilitySlotListResponse,
        client,
      )
    },
  })
}

export function getCloseoutsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseCloseoutsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: availabilityQueryKeys.closeoutsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      if (filters.slotId) params.set("slotId", filters.slotId)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/availability/closeouts${qs ? `?${qs}` : ""}`,
        availabilityCloseoutListResponse,
        client,
      )
    },
  })
}

export function getPickupPointsQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePickupPointsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: availabilityQueryKeys.pickupPointsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/availability/pickup-points${qs ? `?${qs}` : ""}`,
        availabilityPickupPointListResponse,
        client,
      )
    },
  })
}

export function getSlotQueryOptions(
  client: FetchWithValidationOptions,
  id: string | null | undefined,
) {
  return queryOptions({
    queryKey: availabilityQueryKeys.slotDetail(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("getSlotQueryOptions requires an id")
      return fetchWithValidation(
        `/v1/availability/slots/${id}`,
        availabilitySlotSingleResponse,
        client,
      )
    },
  })
}

export function getSlotUnitAvailabilityQueryOptions(
  client: FetchWithValidationOptions,
  slotId: string | null | undefined,
) {
  return queryOptions({
    queryKey: availabilityQueryKeys.slotUnitAvailability(slotId ?? ""),
    queryFn: async () => {
      if (!slotId) throw new Error("getSlotUnitAvailabilityQueryOptions requires a slotId")
      return fetchWithValidation(
        `/v1/availability/slots/${slotId}/unit-availability`,
        slotUnitAvailabilityListResponse,
        client,
      )
    },
  })
}

export function getSlotAllocationQueryOptions(
  client: FetchWithValidationOptions,
  slotId: string | null | undefined,
) {
  return queryOptions({
    queryKey: availabilityQueryKeys.slotAllocation(slotId ?? ""),
    queryFn: async () => {
      if (!slotId) throw new Error("getSlotAllocationQueryOptions requires a slotId")
      return fetchWithValidation(
        `/v1/admin/availability/slots/${slotId}/allocation`,
        slotAllocationManifestResponse,
        client,
      )
    },
  })
}

export function getProductQueryOptions(
  client: FetchWithValidationOptions,
  id: string | null | undefined,
) {
  return queryOptions({
    queryKey: availabilityQueryKeys.product(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("getProductQueryOptions requires an id")
      return fetchWithValidation(`/v1/products/${id}`, productSingleResponse, client)
    },
  })
}

export function getSlotPickupsQueryOptions(
  client: FetchWithValidationOptions,
  slotId: string | null | undefined,
  options: Pick<UseSlotsOptions, "limit" | "offset"> = {},
) {
  const filters = { slotId: slotId ?? undefined, ...options }
  return queryOptions({
    queryKey: availabilityQueryKeys.slotPickupsList(filters),
    queryFn: async () => {
      if (!slotId) throw new Error("getSlotPickupsQueryOptions requires a slotId")
      const params = new URLSearchParams()
      params.set("slotId", slotId)
      appendPagination(params, options)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/availability/slot-pickups?${qs}`,
        availabilitySlotPickupListResponse,
        client,
      )
    },
  })
}

export function getSlotCloseoutsQueryOptions(
  client: FetchWithValidationOptions,
  slotId: string | null | undefined,
  options: Pick<UseCloseoutsOptions, "limit" | "offset"> = {},
) {
  const filters = { slotId: slotId ?? undefined, ...options }
  return queryOptions({
    queryKey: availabilityQueryKeys.slotCloseoutsList(filters),
    queryFn: async () => {
      if (!slotId) throw new Error("getSlotCloseoutsQueryOptions requires a slotId")
      const params = new URLSearchParams()
      params.set("slotId", slotId)
      appendPagination(params, options)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/availability/closeouts?${qs}`,
        availabilityCloseoutListResponse,
        client,
      )
    },
  })
}

export function getSlotAssignmentsQueryOptions(
  client: FetchWithValidationOptions,
  slotId: string | null | undefined,
  options: Pick<UseSlotsOptions, "limit" | "offset"> = {},
) {
  const filters = { slotId: slotId ?? undefined, ...options }
  return queryOptions({
    queryKey: availabilityQueryKeys.slotAssignmentsList(filters),
    queryFn: async () => {
      if (!slotId) throw new Error("getSlotAssignmentsQueryOptions requires a slotId")
      const params = new URLSearchParams()
      params.set("slotId", slotId)
      appendPagination(params, options)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/resources/slot-assignments?${qs}`,
        availabilitySlotAssignmentListResponse,
        client,
      )
    },
  })
}

export function getSlotResourcesQueryOptions(
  client: FetchWithValidationOptions,
  options: Pick<UseProductsOptions, "limit" | "offset"> = {},
) {
  return queryOptions({
    queryKey: availabilityQueryKeys.slotResourcesList(options),
    queryFn: () => {
      const params = new URLSearchParams()
      appendPagination(params, options)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/resources/resources${qs ? `?${qs}` : ""}`,
        resourceSummaryListResponse,
        client,
      )
    },
  })
}

export function getSlotBookingsQueryOptions(
  client: FetchWithValidationOptions,
  options: Pick<UseProductsOptions, "limit" | "offset"> = {},
) {
  return queryOptions({
    queryKey: availabilityQueryKeys.slotBookingsList(options),
    queryFn: () => {
      const params = new URLSearchParams()
      appendPagination(params, options)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/bookings${qs ? `?${qs}` : ""}`,
        bookingSummaryListResponse,
        client,
      )
    },
  })
}
