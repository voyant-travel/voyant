import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { formatMessage } from "@voyantjs/admin"
import { availabilityQueryKeys } from "@voyantjs/availability-react"
import {
  AvailabilityPage as AvailabilityPageBase,
  type AvailabilityPageBulkDeleteHandler,
  type AvailabilityPageBulkUpdateHandler,
  formatLocalizedSelectionLabel,
} from "@voyantjs/availability-ui"
import { useState } from "react"
import { toast } from "sonner"
import type { BatchMutationResponse } from "@/components/voyant/availability/availability-shared"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"

// App-side wrapper around the packaged AvailabilityPage (packaged-admin RFC
// Phase 3). It STAYS in the operator because the bulk handlers call the
// `/v1/availability/*/batch-update|batch-delete` endpoints, which have no
// client functions or hooks in `@voyantjs/availability-react` yet. Slot
// create/edit submits through the package default (`useAvailabilitySlotMutation`).
export function AvailabilityPage() {
  const messages = useAdminMessages()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [bulkActionTarget, setBulkActionTarget] = useState<string | null>(null)

  const refreshAvailability = () =>
    queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.all })

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

    const result = await api.post<BatchMutationResponse>(`${endpoint}/batch-update`, {
      ids,
      patch: payload,
    })

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

    const result = await api.post<BatchMutationResponse>(`${endpoint}/batch-delete`, { ids })

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
    <AvailabilityPageBase
      bulkActionTarget={bulkActionTarget}
      onBulkUpdate={handleBulkUpdate}
      onBulkDelete={handleBulkDelete}
      onSlotOpen={(slotId) => void navigate({ to: "/availability/$id", params: { id: slotId } })}
    />
  )
}
