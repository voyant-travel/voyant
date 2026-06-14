"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertPropertySchema, updatePropertySchema } from "@voyantjs/operations"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFacilitiesContext } from "../provider.js"
import { facilitiesQueryKeys } from "../query-keys.js"
import { propertySingleResponse, successEnvelope } from "../schemas.js"

export type CreatePropertyInput = z.input<typeof insertPropertySchema>
export type UpdatePropertyInput = z.input<typeof updatePropertySchema>

export function usePropertyMutation() {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreatePropertyInput) => {
      const { data } = await fetchWithValidation(
        "/v1/operations/properties",
        propertySingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.properties() })
      queryClient.setQueryData(facilitiesQueryKeys.property(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePropertyInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/operations/properties/${id}`,
        propertySingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.properties() })
      queryClient.setQueryData(facilitiesQueryKeys.property(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/operations/properties/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.properties() })
      queryClient.removeQueries({ queryKey: facilitiesQueryKeys.property(id) })
    },
  })

  return { create, update, remove }
}
