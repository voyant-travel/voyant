"use client"

import { Badge, Button, cn } from "@voyant-travel/ui/components"
import { CalendarDays, Wrench } from "lucide-react"
import { useResourcesUiI18nOrDefault } from "../i18n/index.js"
import { formatDateTimeOrFallback, formatResourceSlotLabel } from "../i18n/utils.js"
import {
  labelById,
  type ResourceSlotAssignmentDetail,
  useAssignment,
  useBookings,
  usePool,
  useProducts,
  useResource,
  useSlots,
} from "../index.js"
import {
  type ConfirmAction,
  ResourceDetailCard,
  ResourceDetailField,
  ResourceDetailHeader,
  ResourceDetailState,
} from "./resource-detail-shared.js"
import { ResourceAssignmentDetailSkeleton } from "./resource-detail-skeletons.js"

// The skeleton lives in `./resource-detail-skeletons.js` — a lean module —
// so the resources admin extension factory can attach it as a
// `pendingComponent` without pinning this page module into the workspace
// chrome chunk. Re-exported here for backwards compatibility.
export { ResourceAssignmentDetailSkeleton }

export interface ResourceAssignmentDetailPageProps {
  id: string
  className?: string
  deleting?: boolean
  onBack?: () => void
  onDelete?: (assignment: ResourceSlotAssignmentDetail) => Promise<void> | void
  onEdit?: (assignment: ResourceSlotAssignmentDetail) => void
  onOpenResource?: (resourceId: string) => void
  onOpenSlot?: (slotId: string) => void
  confirmAction?: ConfirmAction
}

export function ResourceAssignmentDetailPage({
  className,
  confirmAction,
  deleting,
  id,
  onBack,
  onDelete,
  onEdit,
  onOpenResource,
  onOpenSlot,
}: ResourceAssignmentDetailPageProps) {
  const i18n = useResourcesUiI18nOrDefault()
  const m = i18n.messages
  const page = m.detailPages
  const assignmentQuery = useAssignment(id)
  const assignment = assignmentQuery.data
  const slotsQuery = useSlots({ limit: 25 })
  const slot = slotsQuery.data?.data.find((entry) => entry.id === assignment?.slotId)
  const poolQuery = usePool(assignment?.poolId)
  const resourceQuery = useResource(assignment?.resourceId)
  const bookingsQuery = useBookings({ limit: 25 })
  const productsQuery = useProducts({ limit: 25 })

  if (assignmentQuery.isPending) {
    return <ResourceAssignmentDetailSkeleton />
  }

  if (assignmentQuery.isError) {
    return (
      <ResourceDetailState
        className={className}
        message={page.assignment.loadFailed}
        onBack={onBack}
      />
    )
  }

  if (!assignment) {
    return (
      <ResourceDetailState
        className={className}
        message={page.assignment.notFound}
        onBack={onBack}
      />
    )
  }

  const slotLabel = slot
    ? formatResourceSlotLabel(slot, {
        template: m.common.slotLabel,
        formatDate: i18n.formatDate,
        products: productsQuery.data?.data ?? [],
      })
    : assignment.slotId

  return (
    <div
      data-slot="resource-assignment-detail-page"
      className={cn("flex flex-col gap-6", className)}
    >
      <ResourceDetailHeader
        title={page.assignment.pageTitle}
        deleteConfirmName={assignment.id}
        deleteConfirmTemplate={page.assignment.deleteConfirm}
        deleteErrorMessage={page.assignment.deleteFailed}
        deleting={deleting}
        confirmAction={confirmAction}
        onBack={onBack}
        onDelete={onDelete ? () => onDelete(assignment) : undefined}
        onEdit={onEdit ? () => onEdit(assignment) : undefined}
        badges={
          <>
            <Badge variant="outline">{m.common.assignmentStatusLabels[assignment.status]}</Badge>
            <Badge variant="secondary">{slotLabel}</Badge>
          </>
        }
        actions={
          <>
            {onOpenSlot ? (
              <Button type="button" variant="outline" onClick={() => onOpenSlot(assignment.slotId)}>
                <CalendarDays data-icon="inline-start" aria-hidden="true" />
                {page.common.openSlot}
              </Button>
            ) : null}
            {assignment.resourceId && onOpenResource ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenResource(assignment.resourceId!)}
              >
                <Wrench data-icon="inline-start" aria-hidden="true" />
                {page.common.openResource}
              </Button>
            ) : null}
          </>
        }
      />

      <ResourceDetailCard title={page.assignment.detailsTitle}>
        <div className="grid gap-3 md:grid-cols-2">
          <ResourceDetailField label={page.common.slot}>{slotLabel}</ResourceDetailField>
          <ResourceDetailField label={page.common.product}>
            {slot?.productId
              ? labelById(productsQuery.data?.data ?? [], slot.productId)
              : page.common.noValue}
          </ResourceDetailField>
          <ResourceDetailField label={page.common.pool}>
            {poolQuery.data?.name ?? assignment.poolId ?? page.common.noPool}
          </ResourceDetailField>
          <ResourceDetailField label={page.common.resource}>
            {resourceQuery.data?.name ?? assignment.resourceId ?? page.common.noResource}
          </ResourceDetailField>
          <ResourceDetailField label={page.common.booking}>
            {assignment.bookingId
              ? labelById(bookingsQuery.data?.data ?? [], assignment.bookingId)
              : page.common.noBooking}
          </ResourceDetailField>
          <ResourceDetailField label={page.assignment.assignedBy}>
            {assignment.assignedBy ?? page.common.noValue}
          </ResourceDetailField>
          <ResourceDetailField label={page.assignment.released}>
            {formatDateTimeOrFallback(assignment.releasedAt, {
              fallback: page.common.noValue,
              formatDateTime: i18n.formatDateTime,
            })}
          </ResourceDetailField>
          <ResourceDetailField label={page.assignment.assignedAt}>
            {i18n.formatDateTime(assignment.assignedAt)}
          </ResourceDetailField>
        </div>
      </ResourceDetailCard>

      {assignment.notes ? (
        <ResourceDetailCard title={page.common.notes}>
          <p className="whitespace-pre-wrap">{assignment.notes}</p>
        </ResourceDetailCard>
      ) : null}
    </div>
  )
}
