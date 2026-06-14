"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertPropertyGroupSchema,
  updatePropertyGroupSchema,
} from "@voyant-travel/operations"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFacilitiesContext } from "../provider.js"
import { facilitiesQueryKeys } from "../query-keys.js"
import { propertyGroupSingleResponse, successEnvelope } from "../schemas.js"

export type CreatePropertyGroupInput = z.input<typeof insertPropertyGroupSchema>
export type UpdatePropertyGroupInput = z.input<typeof updatePropertyGroupSchema>

export function usePropertyGroupMutation() {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreatePropertyGroupInput) => {
      const { data } = await fetchWithValidation(
        "/v1/operations/property-groups",
        propertyGroupSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.propertyGroups() })
      queryClient.setQueryData(facilitiesQueryKeys.propertyGroup(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePropertyGroupInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/operations/property-groups/${id}`,
        propertyGroupSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.propertyGroups() })
      queryClient.setQueryData(facilitiesQueryKeys.propertyGroup(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/operations/property-groups/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.propertyGroups() })
      queryClient.removeQueries({ queryKey: facilitiesQueryKeys.propertyGroup(id) })
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.propertyGroupMembers() })
    },
  })

  return { create, update, remove }
}
