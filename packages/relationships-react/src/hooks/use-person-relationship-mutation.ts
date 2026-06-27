"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { relationshipsQueryKeys } from "../query-keys.js"
import { type PersonRelationshipKind, personRelationshipSingleResponse } from "../schemas.js"

export interface CreatePersonRelationshipInput {
  toPersonId: string
  kind: PersonRelationshipKind
  /** When set, the route auto-writes the symmetric edge. */
  inverseKind?: PersonRelationshipKind | null
  startDate?: string | null
  endDate?: string | null
  isPrimary?: boolean
  notes?: string | null
  metadata?: Record<string, unknown> | null
  /** Pass `false` to skip the symmetric edge even if `inverseKind` is set. */
  autoInverse?: boolean
}

export interface UpdatePersonRelationshipInput {
  kind?: PersonRelationshipKind
  inverseKind?: PersonRelationshipKind | null
  startDate?: string | null
  endDate?: string | null
  isPrimary?: boolean
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

const deleteResponseSchema = z.object({ success: z.boolean() })

export function usePersonRelationshipMutation(personId: string | undefined) {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    if (personId) {
      void queryClient.invalidateQueries({
        queryKey: [...relationshipsQueryKeys.person(personId), "relationships"],
      })
    }
  }

  const create = useMutation({
    mutationFn: async (input: CreatePersonRelationshipInput) => {
      if (!personId) throw new Error("usePersonRelationshipMutation requires a personId")
      const { data } = await fetchWithValidation(
        `/v1/admin/relationships/people/${personId}/relationships`,
        personRelationshipSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePersonRelationshipInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/relationships/person-relationships/${id}`,
        personRelationshipSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/relationships/person-relationships/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
