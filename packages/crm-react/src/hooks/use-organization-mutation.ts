"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { crmQueryKeys } from "../query-keys.js"
import { organizationSingleResponse } from "../schemas.js"

export interface CreateOrganizationInput {
  name: string
  legalName?: string | null
  vatNumber?: string | null
  website?: string | null
  industry?: string | null
  relation?: string | null
  status?: string
  tags?: string[]
  notes?: string | null
  [key: string]: unknown
}

export type UpdateOrganizationInput = Partial<CreateOrganizationInput>

const deleteResponseSchema = z.object({ success: z.boolean() })

export function useOrganizationMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateOrganizationInput) => {
      const { data } = await fetchWithValidation(
        "/v1/crm/organizations",
        organizationSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.organizations() })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateOrganizationInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/organizations/${id}`,
        organizationSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.organizations() })
      queryClient.setQueryData(crmQueryKeys.organization(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return fetchWithValidation(
        `/v1/crm/organizations/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.organizations() })
      queryClient.removeQueries({ queryKey: crmQueryKeys.organization(id) })
    },
  })

  return { create, update, remove }
}
