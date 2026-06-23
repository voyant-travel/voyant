"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  CreateDelegateBody,
  EnrollDelegateBody,
  UpdateDelegateBody,
} from "@voyant-travel/mice"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { miceQueryKeys } from "../query-keys.js"
import { delegateSingleResponse, enrollmentSingleResponse } from "../schemas.js"

const basePath = "/v1/admin/mice"

/**
 * Create/update mutations for a program's delegates, plus per-delegate session
 * enrollment. All invalidate the delegates list root so any program's delegate
 * table refreshes in place (the list query key carries its filters).
 */
export function useDelegateMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()
  const client = { baseUrl, fetcher }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: miceQueryKeys.delegates() })

  const create = useMutation({
    mutationFn: async (input: CreateDelegateBody) => {
      const { data } = await fetchWithValidation(
        `${basePath}/delegates`,
        delegateSingleResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, ...input }: UpdateDelegateBody & { id: string }) => {
      const { data } = await fetchWithValidation(
        `${basePath}/delegates/${id}`,
        delegateSingleResponse,
        client,
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const enroll = useMutation({
    mutationFn: async ({ delegateId, ...input }: EnrollDelegateBody & { delegateId: string }) => {
      const { data } = await fetchWithValidation(
        `${basePath}/delegates/${delegateId}/enrollments`,
        enrollmentSingleResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  return { create, update, enroll }
}
