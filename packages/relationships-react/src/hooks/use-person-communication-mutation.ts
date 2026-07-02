"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { relationshipsQueryKeys } from "../query-keys.js"
import {
  type CommunicationChannel,
  type CommunicationDirection,
  communicationLogSingleResponse,
} from "../schemas.js"

export interface CreatePersonCommunicationInput {
  organizationId?: string | null
  channel: CommunicationChannel
  direction: CommunicationDirection
  subject?: string | null
  content?: string | null
  sentAt?: string | null
}

export function usePersonCommunicationMutation(personId: string | undefined) {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    if (personId) {
      void queryClient.invalidateQueries({
        queryKey: [...relationshipsQueryKeys.person(personId), "communications"],
      })
    }
  }

  const create = useMutation({
    mutationFn: async (input: CreatePersonCommunicationInput) => {
      if (!personId) throw new Error("usePersonCommunicationMutation requires a personId")
      const { data } = await fetchWithValidation(
        `/v1/admin/relationships/people/${personId}/communications`,
        communicationLogSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  return { create }
}
