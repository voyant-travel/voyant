"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { CreateProgramBody, UpdateProgramBody } from "@voyant-travel/mice"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { miceQueryKeys } from "../query-keys.js"
import { programSingleResponse } from "../schemas.js"

const basePath = "/v1/admin/mice"

export function useProgramMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()
  const client = { baseUrl, fetcher }

  const create = useMutation({
    mutationFn: async (input: CreateProgramBody) => {
      const { data } = await fetchWithValidation(
        `${basePath}/programs`,
        programSingleResponse,
        client,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: miceQueryKeys.programs() })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, ...input }: UpdateProgramBody & { id: string }) => {
      const { data } = await fetchWithValidation(
        `${basePath}/programs/${id}`,
        programSingleResponse,
        client,
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (program) => {
      void queryClient.invalidateQueries({ queryKey: miceQueryKeys.programs() })
      void queryClient.invalidateQueries({ queryKey: miceQueryKeys.program(program.id) })
    },
  })

  return { create, update }
}
