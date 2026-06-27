"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseAddressesOptions } from "./hooks/use-addresses.js"
import type { UseContactPointsOptions } from "./hooks/use-contact-points.js"
import type { UseNamedContactsOptions } from "./hooks/use-named-contacts.js"
import { identityQueryKeys } from "./query-keys.js"
import {
  addressListResponse,
  addressSingleResponse,
  contactPointListResponse,
  contactPointSingleResponse,
  namedContactListResponse,
  namedContactSingleResponse,
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

export function getContactPointsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseContactPointsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: identityQueryKeys.contactPointsList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/identity/contact-points${toQueryString(filters)}`,
        contactPointListResponse,
        client,
      ),
  })
}

export function getContactPointQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: identityQueryKeys.contactPoint(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/admin/identity/contact-points/${id}`,
        contactPointSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getAddressesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseAddressesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: identityQueryKeys.addressesList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/identity/addresses${toQueryString(filters)}`,
        addressListResponse,
        client,
      ),
  })
}

export function getAddressQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: identityQueryKeys.address(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/admin/identity/addresses/${id}`,
        addressSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getNamedContactsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseNamedContactsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: identityQueryKeys.namedContactsList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/identity/named-contacts${toQueryString(filters)}`,
        namedContactListResponse,
        client,
      ),
  })
}

export function getNamedContactQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: identityQueryKeys.namedContact(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/admin/identity/named-contacts/${id}`,
        namedContactSingleResponse,
        client,
      )
      return data
    },
  })
}
