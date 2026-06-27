"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseAllocationOptions } from "./hooks/use-allocation.js"
import type { UseAllocationsOptions } from "./hooks/use-allocations.js"
import type { UseAssignmentOptions } from "./hooks/use-assignment.js"
import type { UseAssignmentsOptions } from "./hooks/use-assignments.js"
import type { UseBookingsOptions } from "./hooks/use-bookings.js"
import type { UseCloseoutsOptions } from "./hooks/use-closeouts.js"
import type { UsePoolOptions } from "./hooks/use-pool.js"
import type { UsePoolsOptions } from "./hooks/use-pools.js"
import type { UseProductsOptions } from "./hooks/use-products.js"
import type { UseResourceOptions } from "./hooks/use-resource.js"
import type { UseResourcesOptions } from "./hooks/use-resources.js"
import type { UseRulesOptions } from "./hooks/use-rules.js"
import type { UseSlotsOptions } from "./hooks/use-slots.js"
import type { UseStartTimesOptions } from "./hooks/use-start-times.js"
import type { UseSuppliersOptions } from "./hooks/use-suppliers.js"
import { resourcesQueryKeys } from "./query-keys.js"
import {
  bookingListResponse,
  productListResponse,
  resourceAllocationListResponse,
  resourceAllocationSingleResponse,
  resourceCloseoutListResponse,
  resourceListResponse,
  resourcePoolListResponse,
  resourcePoolSingleResponse,
  resourceSingleResponse,
  resourceSlotAssignmentListResponse,
  resourceSlotAssignmentSingleResponse,
  ruleListResponse,
  slotListResponse,
  startTimeListResponse,
  supplierListResponse,
} from "./schemas.js"

function appendPagination(params: URLSearchParams, filters: { limit?: number; offset?: number }) {
  if (filters.limit !== undefined) params.set("limit", String(filters.limit))
  if (filters.offset !== undefined) params.set("offset", String(filters.offset))
}

export function getSuppliersQueryOptions(
  client: FetchWithValidationOptions,
  options: UseSuppliersOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.suppliersList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/suppliers${qs ? `?${qs}` : ""}`,
        supplierListResponse,
        client,
      )
    },
  })
}

export function getProductsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseProductsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.productsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/products${qs ? `?${qs}` : ""}`,
        productListResponse,
        client,
      )
    },
  })
}

export function getBookingsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseBookingsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.bookingsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/bookings${qs ? `?${qs}` : ""}`,
        bookingListResponse,
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
    queryKey: resourcesQueryKeys.slotsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/operations/availability/slots${qs ? `?${qs}` : ""}`,
        slotListResponse,
        client,
      )
    },
  })
}

export function getRulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseRulesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.rulesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/operations/availability/rules${qs ? `?${qs}` : ""}`,
        ruleListResponse,
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
    queryKey: resourcesQueryKeys.startTimesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/operations/availability/start-times${qs ? `?${qs}` : ""}`,
        startTimeListResponse,
        client,
      )
    },
  })
}

export function getResourcesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseResourcesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.resourcesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.supplierId) params.set("supplierId", filters.supplierId)
      if (filters.kind) params.set("kind", filters.kind)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.search) params.set("search", filters.search)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/operations/resources${qs ? `?${qs}` : ""}`,
        resourceListResponse,
        client,
      )
    },
  })
}

export function getResourceQueryOptions(
  client: FetchWithValidationOptions,
  id: string | null | undefined,
  options: UseResourceOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.resource(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("getResourceQueryOptions requires an id")
      const { data } = await fetchWithValidation(
        `/v1/admin/operations/resources/${id}`,
        resourceSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getPoolsQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePoolsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.poolsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      if (filters.kind) params.set("kind", filters.kind)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.search) params.set("search", filters.search)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/operations/pools${qs ? `?${qs}` : ""}`,
        resourcePoolListResponse,
        client,
      )
    },
  })
}

export function getPoolQueryOptions(
  client: FetchWithValidationOptions,
  id: string | null | undefined,
  options: UsePoolOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.pool(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("getPoolQueryOptions requires an id")
      const { data } = await fetchWithValidation(
        `/v1/admin/operations/pools/${id}`,
        resourcePoolSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getAllocationsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseAllocationsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.allocationsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.poolId) params.set("poolId", filters.poolId)
      if (filters.productId) params.set("productId", filters.productId)
      if (filters.availabilityRuleId) params.set("availabilityRuleId", filters.availabilityRuleId)
      if (filters.startTimeId) params.set("startTimeId", filters.startTimeId)
      if (filters.allocationMode) params.set("allocationMode", filters.allocationMode)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/operations/allocations${qs ? `?${qs}` : ""}`,
        resourceAllocationListResponse,
        client,
      )
    },
  })
}

export function getAllocationQueryOptions(
  client: FetchWithValidationOptions,
  id: string | null | undefined,
  options: UseAllocationOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.allocation(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("getAllocationQueryOptions requires an id")
      const { data } = await fetchWithValidation(
        `/v1/admin/operations/allocations/${id}`,
        resourceAllocationSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getAssignmentsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseAssignmentsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.assignmentsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.slotId) params.set("slotId", filters.slotId)
      if (filters.poolId) params.set("poolId", filters.poolId)
      if (filters.resourceId) params.set("resourceId", filters.resourceId)
      if (filters.bookingId) params.set("bookingId", filters.bookingId)
      if (filters.status) params.set("status", filters.status)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/operations/slot-assignments${qs ? `?${qs}` : ""}`,
        resourceSlotAssignmentListResponse,
        client,
      )
    },
  })
}

export function getAssignmentQueryOptions(
  client: FetchWithValidationOptions,
  id: string | null | undefined,
  options: UseAssignmentOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.assignment(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("getAssignmentQueryOptions requires an id")
      const { data } = await fetchWithValidation(
        `/v1/admin/operations/slot-assignments/${id}`,
        resourceSlotAssignmentSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getCloseoutsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseCloseoutsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: resourcesQueryKeys.closeoutsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.resourceId) params.set("resourceId", filters.resourceId)
      if (filters.dateLocal) params.set("dateLocal", filters.dateLocal)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/operations/closeouts${qs ? `?${qs}` : ""}`,
        resourceCloseoutListResponse,
        client,
      )
    },
  })
}
