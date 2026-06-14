"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertContactPointSchema, updateContactPointSchema } from "@voyant-travel/identity"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantIdentityContext } from "../provider.js"
import { identityQueryKeys } from "../query-keys.js"
import { contactPointSingleResponse, successEnvelope } from "../schemas.js"

export type CreateContactPointInput = z.input<typeof insertContactPointSchema>
export type UpdateContactPointInput = z.input<typeof updateContactPointSchema>

export function useContactPointMutation() {
  const { baseUrl, fetcher } = useVoyantIdentityContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateContactPointInput) => {
      const { data } = await fetchWithValidation(
        "/v1/identity/contact-points",
        contactPointSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: identityQueryKeys.contactPoints() })
      queryClient.setQueryData(identityQueryKeys.contactPoint(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateContactPointInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/identity/contact-points/${id}`,
        contactPointSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: identityQueryKeys.contactPoints() })
      queryClient.setQueryData(identityQueryKeys.contactPoint(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/identity/contact-points/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: identityQueryKeys.contactPoints() })
      queryClient.removeQueries({ queryKey: identityQueryKeys.contactPoint(id) })
    },
  })

  return { create, update, remove }
}
