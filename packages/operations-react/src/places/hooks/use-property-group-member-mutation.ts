"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertPropertyGroupMemberSchema,
  updatePropertyGroupMemberSchema,
} from "@voyant-travel/operations"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFacilitiesContext } from "../provider.js"
import { facilitiesQueryKeys } from "../query-keys.js"
import { propertyGroupMemberSingleResponse, successEnvelope } from "../schemas.js"

export type CreatePropertyGroupMemberInput = z.input<typeof insertPropertyGroupMemberSchema>
export type UpdatePropertyGroupMemberInput = z.input<typeof updatePropertyGroupMemberSchema>

export function usePropertyGroupMemberMutation() {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreatePropertyGroupMemberInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/operations/property-group-members",
        propertyGroupMemberSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.propertyGroupMembers() })
      queryClient.setQueryData(facilitiesQueryKeys.propertyGroupMember(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePropertyGroupMemberInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/operations/property-group-members/${id}`,
        propertyGroupMemberSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.propertyGroupMembers() })
      queryClient.setQueryData(facilitiesQueryKeys.propertyGroupMember(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/operations/property-group-members/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.propertyGroupMembers() })
      queryClient.removeQueries({ queryKey: facilitiesQueryKeys.propertyGroupMember(id) })
    },
  })

  return { create, update, remove }
}
