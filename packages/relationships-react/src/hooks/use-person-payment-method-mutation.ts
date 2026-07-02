"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { relationshipsQueryKeys } from "../query-keys.js"
import {
  type PersonPaymentMethodBrand,
  personPaymentMethodSingleResponse,
  successEnvelope,
} from "../schemas.js"

export interface CreatePersonPaymentMethodInput {
  brand: PersonPaymentMethodBrand
  last4?: string | null
  holderName?: string | null
  expMonth?: number | null
  expYear?: number | null
  processorToken: string
  isDefault?: boolean
}

export type UpdatePersonPaymentMethodInput = Partial<CreatePersonPaymentMethodInput>

export function usePersonPaymentMethodMutation(personId: string | undefined) {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    if (personId) {
      void queryClient.invalidateQueries({
        queryKey: relationshipsQueryKeys.personPaymentMethods(personId),
      })
    }
  }

  const create = useMutation({
    mutationFn: async (input: CreatePersonPaymentMethodInput) => {
      if (!personId) throw new Error("usePersonPaymentMethodMutation requires a personId")
      const { data } = await fetchWithValidation(
        `/v1/admin/relationships/people/${personId}/payment-methods`,
        personPaymentMethodSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePersonPaymentMethodInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/relationships/person-payment-methods/${id}`,
        personPaymentMethodSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      invalidate()
      queryClient.setQueryData(relationshipsQueryKeys.personPaymentMethod(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/relationships/person-payment-methods/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      invalidate()
      queryClient.removeQueries({ queryKey: relationshipsQueryKeys.personPaymentMethod(id) })
    },
  })

  return { create, update, remove }
}
