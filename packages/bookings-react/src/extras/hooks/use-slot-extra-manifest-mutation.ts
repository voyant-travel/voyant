"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  slotExtraCollectionBulkSchema,
  slotExtraSelectionBulkSchema,
  slotExtraSelectionPatchSchema,
} from "@voyantjs/bookings/extras"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantExtrasContext } from "../provider.js"
import { extrasQueryKeys } from "../query-keys.js"
import { slotExtraManifestMutationResponse } from "../schemas.js"

export type SlotExtraSelectionPatchInput = z.input<typeof slotExtraSelectionPatchSchema>
export type SlotExtraSelectionBulkInput = z.input<typeof slotExtraSelectionBulkSchema>
export type SlotExtraCollectionBulkInput = z.input<typeof slotExtraCollectionBulkSchema>

export function useSlotExtraManifestMutation(slotId: string) {
  const { baseUrl, fetcher } = useVoyantExtrasContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: extrasQueryKeys.slotManifest(slotId) })
  }

  const setSelection = useMutation({
    mutationFn: (input: SlotExtraSelectionPatchInput) =>
      fetchWithValidation(
        `/v1/extras/slot-manifests/${slotId}/selections`,
        slotExtraManifestMutationResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    onSuccess: invalidate,
  })

  const bulkSetSelections = useMutation({
    mutationFn: (input: SlotExtraSelectionBulkInput) =>
      fetchWithValidation(
        `/v1/extras/slot-manifests/${slotId}/selections/bulk`,
        slotExtraManifestMutationResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: invalidate,
  })

  const bulkUpdateCollections = useMutation({
    mutationFn: (input: SlotExtraCollectionBulkInput) =>
      fetchWithValidation(
        `/v1/extras/slot-manifests/${slotId}/collections/bulk`,
        slotExtraManifestMutationResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: invalidate,
  })

  return { setSelection, bulkSetSelections, bulkUpdateCollections }
}
