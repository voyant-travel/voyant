"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertNamedContactSchema, updateNamedContactSchema } from "@voyant-travel/identity"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantIdentityContext } from "../provider.js"
import { identityQueryKeys } from "../query-keys.js"
import { namedContactSingleResponse, successEnvelope } from "../schemas.js"

export type CreateNamedContactInput = z.input<typeof insertNamedContactSchema>
export type UpdateNamedContactInput = z.input<typeof updateNamedContactSchema>

export function useNamedContactMutation() {
  const { baseUrl, fetcher } = useVoyantIdentityContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateNamedContactInput) => {
      const { data } = await fetchWithValidation(
        "/v1/identity/named-contacts",
        namedContactSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: identityQueryKeys.namedContacts() })
      queryClient.setQueryData(identityQueryKeys.namedContact(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateNamedContactInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/identity/named-contacts/${id}`,
        namedContactSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: identityQueryKeys.namedContacts() })
      queryClient.setQueryData(identityQueryKeys.namedContact(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/identity/named-contacts/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: identityQueryKeys.namedContacts() })
      queryClient.removeQueries({ queryKey: identityQueryKeys.namedContact(id) })
    },
  })

  return { create, update, remove }
}
