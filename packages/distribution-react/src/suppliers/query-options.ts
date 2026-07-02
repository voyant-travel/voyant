"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseSuppliersOptions } from "./hooks/use-suppliers.js"
import type { SupplierAvailabilityFilters } from "./query-keys.js"
import { suppliersQueryKeys } from "./query-keys.js"
import {
  supplierAddressesResponse,
  supplierAvailabilityResponse,
  supplierContactPointsResponse,
  supplierContractsResponse,
  supplierDetailResponse,
  supplierListResponse,
  supplierNamedContactsResponse,
  supplierNotesResponse,
  supplierRatesResponse,
  supplierServicesResponse,
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
    queryKey: suppliersQueryKeys.suppliersList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.type) params.set("type", filters.type)
      if (filters.status) params.set("status", filters.status)
      if (filters.country) params.set("country", filters.country)
      if (filters.defaultCurrency) params.set("defaultCurrency", filters.defaultCurrency)
      if (filters.primaryFacilityId) params.set("primaryFacilityId", filters.primaryFacilityId)
      if (filters.sortBy) params.set("sortBy", filters.sortBy)
      if (filters.sortDir) params.set("sortDir", filters.sortDir)
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

export function getSupplierQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: suppliersQueryKeys.supplierDetail(id),
    queryFn: () => fetchWithValidation(`/v1/admin/suppliers/${id}`, supplierDetailResponse, client),
  })
}

export function getSupplierServicesQueryOptions(
  client: FetchWithValidationOptions,
  supplierId: string,
) {
  return queryOptions({
    queryKey: suppliersQueryKeys.supplierServices(supplierId),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/services`,
        supplierServicesResponse,
        client,
      ),
  })
}

export function getSupplierNotesQueryOptions(
  client: FetchWithValidationOptions,
  supplierId: string,
) {
  return queryOptions({
    queryKey: suppliersQueryKeys.supplierNotes(supplierId),
    queryFn: () =>
      fetchWithValidation(`/v1/admin/suppliers/${supplierId}/notes`, supplierNotesResponse, client),
  })
}

export function getSupplierContactPointsQueryOptions(
  client: FetchWithValidationOptions,
  supplierId: string,
) {
  return queryOptions({
    queryKey: suppliersQueryKeys.supplierContactPoints(supplierId),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/contact-points`,
        supplierContactPointsResponse,
        client,
      ),
  })
}

export function getSupplierContactsQueryOptions(
  client: FetchWithValidationOptions,
  supplierId: string,
) {
  return queryOptions({
    queryKey: suppliersQueryKeys.supplierContacts(supplierId),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/contacts`,
        supplierNamedContactsResponse,
        client,
      ),
  })
}

export function getSupplierAddressesQueryOptions(
  client: FetchWithValidationOptions,
  supplierId: string,
) {
  return queryOptions({
    queryKey: suppliersQueryKeys.supplierAddresses(supplierId),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/addresses`,
        supplierAddressesResponse,
        client,
      ),
  })
}

export function getSupplierAvailabilityQueryOptions(
  client: FetchWithValidationOptions,
  supplierId: string,
  filters: SupplierAvailabilityFilters = {},
) {
  return queryOptions({
    queryKey: suppliersQueryKeys.supplierAvailability(supplierId, filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.from) params.set("from", filters.from)
      if (filters.to) params.set("to", filters.to)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/availability${qs ? `?${qs}` : ""}`,
        supplierAvailabilityResponse,
        client,
      )
    },
  })
}

export function getSupplierContractsQueryOptions(
  client: FetchWithValidationOptions,
  supplierId: string,
) {
  return queryOptions({
    queryKey: suppliersQueryKeys.supplierContracts(supplierId),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/contracts`,
        supplierContractsResponse,
        client,
      ),
  })
}

export function getSupplierServiceRatesQueryOptions(
  client: FetchWithValidationOptions,
  supplierId: string,
  serviceId: string,
) {
  return queryOptions({
    queryKey: suppliersQueryKeys.supplierServiceRates(supplierId, serviceId),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/suppliers/${supplierId}/services/${serviceId}/rates`,
        supplierRatesResponse,
        client,
      ),
  })
}
