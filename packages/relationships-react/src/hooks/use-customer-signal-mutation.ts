"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { relationshipsQueryKeys } from "../query-keys.js"
import {
  type CustomerSignalKind,
  type CustomerSignalSource,
  type CustomerSignalStatus,
  customerSignalSingleResponse,
} from "../schemas.js"

export type CustomerSignalPriority = "low" | "normal" | "high" | "urgent"

export interface CreateCustomerSignalInput {
  personId: string
  kind: CustomerSignalKind
  source: CustomerSignalSource
  productId?: string | null
  optionUnitId?: string | null
  status?: CustomerSignalStatus
  priority?: CustomerSignalPriority
  notes?: string | null
  tags?: string[]
  assignedToUserId?: string | null
  /** ISO datetime string. */
  followUpAt?: string | null
  resolvedBookingId?: string | null
  sourceSubmissionId?: string | null
  metadata?: Record<string, unknown> | null
}

export type UpdateCustomerSignalInput = Partial<Omit<CreateCustomerSignalInput, "personId">>

const deleteResponseSchema = z.object({ success: z.boolean() })

export function useCustomerSignalMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const invalidateLists = () => {
    void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.customerSignals() })
  }
  const invalidatePerson = (personId: string | null | undefined) => {
    if (personId) {
      void queryClient.invalidateQueries({
        queryKey: relationshipsQueryKeys.customerSignalsByPerson(personId),
      })
    }
  }

  const create = useMutation({
    mutationFn: async (input: CreateCustomerSignalInput) => {
      const { data } = await fetchWithValidation(
        "/v1/relationships/customer-signals",
        customerSignalSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      invalidateLists()
      invalidatePerson(data.personId)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCustomerSignalInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/relationships/customer-signals/${id}`,
        customerSignalSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      invalidateLists()
      invalidatePerson(data.personId)
      queryClient.setQueryData(relationshipsQueryKeys.customerSignal(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/relationships/customer-signals/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      invalidateLists()
      queryClient.removeQueries({ queryKey: relationshipsQueryKeys.customerSignal(id) })
    },
  })

  /**
   * Closes the loop: marks a signal as `converted` and records the
   * booking it became. The caller has already created the booking.
   */
  const resolve = useMutation({
    mutationFn: async ({ id, bookingId }: { id: string; bookingId: string }) => {
      const { data } = await fetchWithValidation(
        `/v1/relationships/customer-signals/${id}/resolve`,
        customerSignalSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({ bookingId }) },
      )
      return data
    },
    onSuccess: (data) => {
      invalidateLists()
      invalidatePerson(data.personId)
      queryClient.setQueryData(relationshipsQueryKeys.customerSignal(data.id), data)
    },
  })

  return { create, update, remove, resolve }
}
