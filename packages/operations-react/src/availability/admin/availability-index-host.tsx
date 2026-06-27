"use client"

import { useQueryClient } from "@tanstack/react-query"
import { formatMessage, useAdminNavigate, useOperatorAdminMessages } from "@voyant-travel/admin"
import { useState } from "react"
import { toast } from "sonner"
import {
  AvailabilityPage,
  type AvailabilityPageBulkDeleteHandler,
  type AvailabilityPageBulkUpdateHandler,
} from "../components/availability-page.js"
import {
  availabilityQueryKeys,
  type UpdateAvailabilityCloseoutInput,
  type UpdateAvailabilityPickupPointInput,
  type UpdateAvailabilityRuleInput,
  type UpdateAvailabilitySlotInput,
  type UpdateAvailabilityStartTimeInput,
  useAvailabilityCloseoutBatchMutation,
  useAvailabilityPickupPointBatchMutation,
  useAvailabilityRuleBatchMutation,
  useAvailabilitySlotBatchMutation,
  useAvailabilityStartTimeBatchMutation,
} from "../index.js"
import { formatLocalizedSelectionLabel } from "../utils.js"

/**
 * Packaged admin host for the availability index page (packaged-admin RFC
 * Phase 3). Zero-prop: list/filter state stays component-local (no URL
 * search contract), opening a slot resolves through the
 * `availabilitySlot.detail` semantic destination, and the bulk
 * update/delete handlers run through the typed batch mutation pairs from
 * `@voyant-travel/operations-react/availability` (the `batch-update`/`batch-delete`
 * endpoints) instead of an app RPC client. Slot create/edit submits through
 * the package default (`useAvailabilitySlotMutation`).
 */
export function AvailabilityIndexHost() {
  const messages = useOperatorAdminMessages()
  const navigateTo = useAdminNavigate()
  const queryClient = useQueryClient()
  const [bulkActionTarget, setBulkActionTarget] = useState<string | null>(null)

  const ruleBatch = useAvailabilityRuleBatchMutation()
  const startTimeBatch = useAvailabilityStartTimeBatchMutation()
  const slotBatch = useAvailabilitySlotBatchMutation()
  const closeoutBatch = useAvailabilityCloseoutBatchMutation()
  const pickupPointBatch = useAvailabilityPickupPointBatchMutation()

  const refreshAvailability = () =>
    queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.all })

  // The tabs identify their batch endpoints by REST path; resolve each to
  // the matching typed batch mutation pair. The page currently only emits
  // the slots endpoint, but every availability list entity is covered so
  // additional tabs slot in without touching the host.
  const runBatchUpdate = (endpoint: string, ids: string[], payload: Record<string, unknown>) => {
    switch (endpoint) {
      case "/v1/admin/operations/availability/rules":
        return ruleBatch.batchUpdate.mutateAsync({
          ids,
          patch: payload as UpdateAvailabilityRuleInput,
        })
      case "/v1/admin/operations/availability/start-times":
        return startTimeBatch.batchUpdate.mutateAsync({
          ids,
          patch: payload as UpdateAvailabilityStartTimeInput,
        })
      case "/v1/admin/operations/availability/closeouts":
        return closeoutBatch.batchUpdate.mutateAsync({
          ids,
          patch: payload as UpdateAvailabilityCloseoutInput,
        })
      case "/v1/admin/operations/availability/pickup-points":
        return pickupPointBatch.batchUpdate.mutateAsync({
          ids,
          patch: payload as UpdateAvailabilityPickupPointInput,
        })
      default:
        return slotBatch.batchUpdate.mutateAsync({
          ids,
          patch: payload as UpdateAvailabilitySlotInput,
        })
    }
  }

  const runBatchDelete = (endpoint: string, ids: string[]) => {
    switch (endpoint) {
      case "/v1/admin/operations/availability/rules":
        return ruleBatch.batchDelete.mutateAsync({ ids })
      case "/v1/admin/operations/availability/start-times":
        return startTimeBatch.batchDelete.mutateAsync({ ids })
      case "/v1/admin/operations/availability/closeouts":
        return closeoutBatch.batchDelete.mutateAsync({ ids })
      case "/v1/admin/operations/availability/pickup-points":
        return pickupPointBatch.batchDelete.mutateAsync({ ids })
      default:
        return slotBatch.batchDelete.mutateAsync({ ids })
    }
  }

  const slotsNounSingular = messages.availability.tabs.slots.title
  const slotsNounPlural = messages.availability.tabs.slots.title

  const handleBulkUpdate: AvailabilityPageBulkUpdateHandler = async ({
    ids,
    endpoint,
    target,
    nounSingular,
    nounPlural,
    payload,
    successVerb,
    clearSelection,
  }) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    const result = await runBatchUpdate(endpoint, ids, payload)

    await refreshAvailability()
    clearSelection()
    setBulkActionTarget(null)

    const succeededSelection = formatLocalizedSelectionLabel(
      result.succeeded,
      nounSingular ?? slotsNounSingular,
      nounPlural ?? slotsNounPlural,
    )
    const totalSelection = formatLocalizedSelectionLabel(
      result.total,
      nounSingular ?? slotsNounSingular,
      nounPlural ?? slotsNounPlural,
    )

    if (result.failed.length === 0) {
      toast.success(
        formatMessage(messages.availability.toasts.bulkUpdated, {
          verb: successVerb,
          selection: succeededSelection,
        }),
      )
      return
    }

    toast.error(
      formatMessage(messages.availability.toasts.bulkUpdatedPartial, {
        verb: successVerb,
        succeeded: result.succeeded,
        selection: totalSelection,
      }),
    )
  }

  const handleBulkDelete: AvailabilityPageBulkDeleteHandler = async ({
    ids,
    endpoint,
    target,
    nounSingular,
    nounPlural,
    clearSelection,
  }) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    const result = await runBatchDelete(endpoint, ids)

    await refreshAvailability()
    clearSelection()
    setBulkActionTarget(null)

    const succeededSelection = formatLocalizedSelectionLabel(
      result.succeeded,
      nounSingular ?? slotsNounSingular,
      nounPlural ?? slotsNounPlural,
    )
    const totalSelection = formatLocalizedSelectionLabel(
      result.total,
      nounSingular ?? slotsNounSingular,
      nounPlural ?? slotsNounPlural,
    )

    if (result.failed.length === 0) {
      toast.success(
        formatMessage(messages.availability.toasts.bulkDeleted, {
          selection: succeededSelection,
        }),
      )
      return
    }

    toast.error(
      formatMessage(messages.availability.toasts.bulkDeletedPartial, {
        succeeded: result.succeeded,
        selection: totalSelection,
      }),
    )
  }

  return (
    <AvailabilityPage
      bulkActionTarget={bulkActionTarget}
      onBulkUpdate={handleBulkUpdate}
      onBulkDelete={handleBulkDelete}
      onSlotOpen={(slotId) => navigateTo("availabilitySlot.detail", { slotId })}
    />
  )
}
