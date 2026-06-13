"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseFacilitiesOptions } from "./hooks/use-facilities.js"
import type { UseFacilityFeaturesOptions } from "./hooks/use-facility-features.js"
import type { UseFacilityOperationSchedulesOptions } from "./hooks/use-facility-operation-schedules.js"
import type { UsePropertiesOptions } from "./hooks/use-properties.js"
import type { UsePropertyGroupMembersOptions } from "./hooks/use-property-group-members.js"
import type { UsePropertyGroupsOptions } from "./hooks/use-property-groups.js"
import { facilitiesQueryKeys } from "./query-keys.js"
import {
  facilityFeatureListResponse,
  facilityFeatureSingleResponse,
  facilityListResponse,
  facilityOperationScheduleListResponse,
  facilityOperationScheduleSingleResponse,
  facilitySingleResponse,
  propertyGroupListResponse,
  propertyGroupMemberListResponse,
  propertyGroupMemberSingleResponse,
  propertyGroupSingleResponse,
  propertyListResponse,
  propertySingleResponse,
} from "./schemas.js"

function toQueryString(filters: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export function getFacilitiesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseFacilitiesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: facilitiesQueryKeys.facilitiesList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/operations/places/operations/places${toQueryString(filters)}`,
        facilityListResponse,
        client,
      ),
  })
}

export function getFacilityQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: facilitiesQueryKeys.facility(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/operations/places/operations/places/${id}`,
        facilitySingleResponse,
        client,
      )
      return data
    },
  })
}

export function getFacilityFeaturesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseFacilityFeaturesOptions,
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: facilitiesQueryKeys.facilityFeaturesList(filters),
    queryFn: async () => {
      if (!filters.facilityId) {
        throw new Error("getFacilityFeaturesQueryOptions requires a facilityId")
      }
      return fetchWithValidation(
        `/v1/operations/places/facility-features${toQueryString(filters)}`,
        facilityFeatureListResponse,
        client,
      )
    },
  })
}

export function getFacilityFeatureQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: facilitiesQueryKeys.facilityFeature(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/operations/places/facility-features/${id}`,
        facilityFeatureSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getFacilityOperationSchedulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseFacilityOperationSchedulesOptions,
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: facilitiesQueryKeys.facilityOperationSchedulesList(filters),
    queryFn: async () => {
      if (!filters.facilityId) {
        throw new Error("getFacilityOperationSchedulesQueryOptions requires a facilityId")
      }
      return fetchWithValidation(
        `/v1/operations/places/facility-operation-schedules${toQueryString(filters)}`,
        facilityOperationScheduleListResponse,
        client,
      )
    },
  })
}

export function getFacilityOperationScheduleQueryOptions(
  client: FetchWithValidationOptions,
  id: string,
) {
  return queryOptions({
    queryKey: facilitiesQueryKeys.facilityOperationSchedule(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/operations/places/facility-operation-schedules/${id}`,
        facilityOperationScheduleSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getPropertiesQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePropertiesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: facilitiesQueryKeys.propertiesList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/operations/places/properties${toQueryString(filters)}`,
        propertyListResponse,
        client,
      ),
  })
}

export function getPropertyQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: facilitiesQueryKeys.property(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/operations/places/properties/${id}`,
        propertySingleResponse,
        client,
      )
      return data
    },
  })
}

export function getPropertyGroupsQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePropertyGroupsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: facilitiesQueryKeys.propertyGroupsList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/operations/places/property-groups${toQueryString(filters)}`,
        propertyGroupListResponse,
        client,
      ),
  })
}

export function getPropertyGroupQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: facilitiesQueryKeys.propertyGroup(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/operations/places/property-groups/${id}`,
        propertyGroupSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getPropertyGroupMembersQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePropertyGroupMembersOptions,
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: facilitiesQueryKeys.propertyGroupMembersList(filters),
    queryFn: async () => {
      if (!filters.groupId) {
        throw new Error("getPropertyGroupMembersQueryOptions requires a groupId")
      }
      return fetchWithValidation(
        `/v1/operations/places/property-group-members${toQueryString(filters)}`,
        propertyGroupMemberListResponse,
        client,
      )
    },
  })
}

export function getPropertyGroupMemberQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: facilitiesQueryKeys.propertyGroupMember(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/operations/places/property-group-members/${id}`,
        propertyGroupMemberSingleResponse,
        client,
      )
      return data
    },
  })
}

export const getPlacesQueryOptions = getFacilitiesQueryOptions
export const getPlaceQueryOptions = getFacilityQueryOptions
export const getPlaceFeaturesQueryOptions = getFacilityFeaturesQueryOptions
export const getPlaceFeatureQueryOptions = getFacilityFeatureQueryOptions
export const getPlaceOperationSchedulesQueryOptions = getFacilityOperationSchedulesQueryOptions
export const getPlaceOperationScheduleQueryOptions = getFacilityOperationScheduleQueryOptions
