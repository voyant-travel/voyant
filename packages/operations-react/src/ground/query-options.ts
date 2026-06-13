"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseGroundDriversOptions } from "./hooks/use-ground-drivers.js"
import type { UseGroundOperatorsOptions } from "./hooks/use-ground-operators.js"
import type { UseGroundVehiclesOptions } from "./hooks/use-ground-vehicles.js"
import { groundQueryKeys } from "./query-keys.js"
import {
  groundDriverListResponse,
  groundDriverSingleResponse,
  groundOperatorListResponse,
  groundOperatorSingleResponse,
  groundVehicleListResponse,
  groundVehicleSingleResponse,
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

export function getGroundOperatorsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseGroundOperatorsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: groundQueryKeys.operatorsList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/operations/ground/operators${toQueryString(filters)}`,
        groundOperatorListResponse,
        client,
      ),
  })
}

export function getGroundOperatorQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: groundQueryKeys.operator(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/operations/ground/operators/${id}`,
        groundOperatorSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getGroundVehiclesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseGroundVehiclesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: groundQueryKeys.vehiclesList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/operations/ground/vehicles${toQueryString(filters)}`,
        groundVehicleListResponse,
        client,
      ),
  })
}

export function getGroundVehicleQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: groundQueryKeys.vehicle(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/operations/ground/vehicles/${id}`,
        groundVehicleSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getGroundDriversQueryOptions(
  client: FetchWithValidationOptions,
  options: UseGroundDriversOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: groundQueryKeys.driversList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/operations/ground/drivers${toQueryString(filters)}`,
        groundDriverListResponse,
        client,
      ),
  })
}

export function getGroundDriverQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: groundQueryKeys.driver(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/operations/ground/drivers/${id}`,
        groundDriverSingleResponse,
        client,
      )
      return data
    },
  })
}
