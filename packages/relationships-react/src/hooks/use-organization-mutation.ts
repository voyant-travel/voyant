"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { relationshipsQueryKeys } from "../query-keys.js"
import { organizationSingleResponse } from "../schemas.js"

export interface CreateOrganizationInput {
  name: string
  legalName?: string | null
  taxId?: string | null
  website?: string | null
  industry?: string | null
  relation?: string | null
  status?: string
  tags?: string[]
  notes?: string | null
  [key: string]: unknown
}

export type UpdateOrganizationInput = Partial<CreateOrganizationInput>

export interface MergeOrganizationInput {
  keepId: string
  mergeId: string
}

const deleteResponseSchema = z.object({ success: z.boolean() })

export function useOrganizationMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateOrganizationInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/relationships/organizations",
        organizationSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.organizations() })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateOrganizationInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/relationships/organizations/${id}`,
        organizationSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.organizations() })
      queryClient.setQueryData(relationshipsQueryKeys.organization(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return fetchWithValidation(
        `/v1/admin/relationships/organizations/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.organizations() })
      queryClient.removeQueries({ queryKey: relationshipsQueryKeys.organization(id) })
    },
  })

  const merge = useMutation({
    mutationFn: async ({ keepId, mergeId }: MergeOrganizationInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/relationships/organizations/${keepId}/merge`,
        organizationSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({ mergeId }) },
      )
      return data
    },
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.organizations() })
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.people() })
      queryClient.setQueryData(relationshipsQueryKeys.organization(data.id), data)
      queryClient.removeQueries({
        queryKey: relationshipsQueryKeys.organization(variables.mergeId),
      })
    },
  })

  return { create, update, remove, merge }
}
