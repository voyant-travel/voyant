"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertAddressSchema, updateAddressSchema } from "@voyant-travel/identity"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantIdentityContext } from "../provider.js"
import { identityQueryKeys } from "../query-keys.js"
import { addressSingleResponse, successEnvelope } from "../schemas.js"

export type CreateAddressInput = z.input<typeof insertAddressSchema>
export type UpdateAddressInput = z.input<typeof updateAddressSchema>

export function useAddressMutation() {
  const { baseUrl, fetcher } = useVoyantIdentityContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateAddressInput) => {
      const { data } = await fetchWithValidation(
        "/v1/identity/addresses",
        addressSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: identityQueryKeys.addresses() })
      queryClient.setQueryData(identityQueryKeys.address(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateAddressInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/identity/addresses/${id}`,
        addressSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: identityQueryKeys.addresses() })
      queryClient.setQueryData(identityQueryKeys.address(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/identity/addresses/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: identityQueryKeys.addresses() })
      queryClient.removeQueries({ queryKey: identityQueryKeys.address(id) })
    },
  })

  return { create, update, remove }
}
