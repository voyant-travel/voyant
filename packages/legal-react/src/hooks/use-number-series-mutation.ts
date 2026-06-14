"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertContractNumberSeriesSchema,
  updateContractNumberSeriesSchema,
} from "@voyant-travel/legal/contracts/validation"
import type { z } from "zod"
import { fetchWithValidation } from "../client.js"
import { useVoyantLegalContext } from "../provider.js"
import { legalQueryKeys } from "../query-keys.js"
import { legalContractNumberSeriesSingleResponse, successEnvelope } from "../schemas.js"

export type CreateLegalContractNumberSeriesInput = z.input<typeof insertContractNumberSeriesSchema>
export type UpdateLegalContractNumberSeriesInput = z.input<typeof updateContractNumberSeriesSchema>

export function useLegalContractNumberSeriesMutation() {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateLegalContractNumberSeriesInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/legal/contracts/number-series",
        legalContractNumberSeriesSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.numberSeries() })
      queryClient.setQueryData(legalQueryKeys.numberSeriesDetail(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateLegalContractNumberSeriesInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/legal/contracts/number-series/${id}`,
        legalContractNumberSeriesSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.numberSeries() })
      queryClient.setQueryData(legalQueryKeys.numberSeriesDetail(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/legal/contracts/number-series/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.numberSeries() })
      queryClient.removeQueries({ queryKey: legalQueryKeys.numberSeriesDetail(id) })
    },
  })

  return { create, update, remove }
}
