"use client"

import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantAvailabilityContext } from "../provider.js"
import { availabilityQueryKeys } from "../query-keys.js"
import {
  availabilityCloseoutRecordSchema,
  availabilityPickupPointRecordSchema,
  availabilityRuleRecordSchema,
  availabilitySlotRecordSchema,
  availabilityStartTimeRecordSchema,
  type BatchDeleteResponse,
  type BatchUpdateResponse,
  batchDeleteEnvelope,
  batchUpdateEnvelope,
  type UpdateAvailabilityCloseoutInput,
  type UpdateAvailabilityPickupPointInput,
  type UpdateAvailabilityRuleInput,
  type UpdateAvailabilitySlotInput,
  type UpdateAvailabilityStartTimeInput,
} from "../schemas.js"

export interface BatchUpdateVariables<TPatch> {
  ids: string[]
  patch: TPatch
}

export interface BatchDeleteVariables {
  ids: string[]
}

/**
 * Shared plumbing for the `POST <entity>/batch-update` + `/batch-delete`
 * endpoint pairs the availability module exposes for every list entity.
 * Each mutation sends the whole id selection in one request and resolves
 * the server's success/partial-failure envelope (`{ total, succeeded,
 * failed }` plus the updated rows on update / `deletedIds` on delete) —
 * callers branch their toasts on `failed.length`. Invalidation is scoped
 * to the entity's query-key root, mirroring the single-record mutation
 * hooks.
 */
function useAvailabilityBatchMutationPair<TPatch, TRecordSchema extends z.ZodTypeAny>(
  basePath: string,
  recordSchema: TRecordSchema,
  queryKey: () => QueryKey,
) {
  const { baseUrl, fetcher } = useVoyantAvailabilityContext()
  const queryClient = useQueryClient()

  const batchUpdate = useMutation({
    mutationFn: async ({
      ids,
      patch,
    }: BatchUpdateVariables<TPatch>): Promise<BatchUpdateResponse<z.output<TRecordSchema>>> =>
      fetchWithValidation(
        `${basePath}/batch-update`,
        batchUpdateEnvelope(recordSchema),
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({ ids, patch }) },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKey() })
    },
  })

  const batchDelete = useMutation({
    mutationFn: async ({ ids }: BatchDeleteVariables): Promise<BatchDeleteResponse> =>
      fetchWithValidation(
        `${basePath}/batch-delete`,
        batchDeleteEnvelope,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({ ids }) },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKey() })
    },
  })

  return { batchUpdate, batchDelete }
}

/** Batch mutations for `POST /v1/operations/availability/rules/{batch-update,batch-delete}`. */
export function useAvailabilityRuleBatchMutation() {
  return useAvailabilityBatchMutationPair<
    UpdateAvailabilityRuleInput,
    typeof availabilityRuleRecordSchema
  >("/v1/operations/availability/rules", availabilityRuleRecordSchema, availabilityQueryKeys.rules)
}

/** Batch mutations for `POST /v1/operations/availability/start-times/{batch-update,batch-delete}`. */
export function useAvailabilityStartTimeBatchMutation() {
  return useAvailabilityBatchMutationPair<
    UpdateAvailabilityStartTimeInput,
    typeof availabilityStartTimeRecordSchema
  >(
    "/v1/operations/availability/start-times",
    availabilityStartTimeRecordSchema,
    availabilityQueryKeys.startTimes,
  )
}

/** Batch mutations for `POST /v1/operations/availability/slots/{batch-update,batch-delete}`. */
export function useAvailabilitySlotBatchMutation() {
  return useAvailabilityBatchMutationPair<
    UpdateAvailabilitySlotInput,
    typeof availabilitySlotRecordSchema
  >("/v1/operations/availability/slots", availabilitySlotRecordSchema, availabilityQueryKeys.slots)
}

/** Batch mutations for `POST /v1/operations/availability/closeouts/{batch-update,batch-delete}`. */
export function useAvailabilityCloseoutBatchMutation() {
  return useAvailabilityBatchMutationPair<
    UpdateAvailabilityCloseoutInput,
    typeof availabilityCloseoutRecordSchema
  >(
    "/v1/operations/availability/closeouts",
    availabilityCloseoutRecordSchema,
    availabilityQueryKeys.closeouts,
  )
}

/** Batch mutations for `POST /v1/operations/availability/pickup-points/{batch-update,batch-delete}`. */
export function useAvailabilityPickupPointBatchMutation() {
  return useAvailabilityBatchMutationPair<
    UpdateAvailabilityPickupPointInput,
    typeof availabilityPickupPointRecordSchema
  >(
    "/v1/operations/availability/pickup-points",
    availabilityPickupPointRecordSchema,
    availabilityQueryKeys.pickupPoints,
  )
}
