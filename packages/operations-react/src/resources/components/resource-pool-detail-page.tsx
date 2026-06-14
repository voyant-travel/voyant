"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from "@voyant-travel/ui/components"
import { Package, Users, Wrench } from "lucide-react"
import { useResourcesUiI18nOrDefault } from "../i18n/index.js"
import { formatResourceSlotLabel } from "../i18n/utils.js"
import {
  labelById,
  type ResourceAllocationRow,
  type ResourcePoolDetail,
  useAllocations,
  useAssignments,
  useBookings,
  usePool,
  useProducts,
  useResources,
  useSlots,
} from "../index.js"
import { useResourcePoolMembers } from "./resource-detail-data.js"
import { ResourceAssignmentSummary } from "./resource-detail-page.js"
import {
  type ConfirmAction,
  ResourceDetailCard,
  ResourceDetailField,
  ResourceDetailHeader,
  ResourceDetailState,
} from "./resource-detail-shared.js"
import { ResourcePoolDetailSkeleton } from "./resource-detail-skeletons.js"

// The skeleton lives in `./resource-detail-skeletons.js` — a lean module —
// so the resources admin extension factory can attach it as a
// `pendingComponent` without pinning this page module into the workspace
// chrome chunk. Re-exported here for backwards compatibility.
export { ResourcePoolDetailSkeleton }

export interface ResourcePoolDetailPageProps {
  id: string
  className?: string
  deleting?: boolean
  onBack?: () => void
  onDelete?: (pool: ResourcePoolDetail) => Promise<void> | void
  onOpenAllocation?: (allocationId: string) => void
  onOpenProduct?: (productId: string) => void
  onOpenResource?: (resourceId: string) => void
  onOpenAssignment?: (assignmentId: string) => void
  confirmAction?: ConfirmAction
}

export function ResourcePoolDetailPage({
  className,
  confirmAction,
  deleting,
  id,
  onBack,
  onDelete,
  onOpenAllocation,
  onOpenAssignment,
  onOpenProduct,
  onOpenResource,
}: ResourcePoolDetailPageProps) {
  const i18n = useResourcesUiI18nOrDefault()
  const m = i18n.messages
  const page = m.detailPages
  const poolQuery = usePool(id)
  const productsQuery = useProducts({ limit: 25 })
  const membersQuery = useResourcePoolMembers({ poolId: id, limit: 25 })
  const resourcesQuery = useResources({ limit: 25 })
  const allocationsQuery = useAllocations({ poolId: id, limit: 25 })
  const assignmentsQuery = useAssignments({ poolId: id, limit: 25 })
  const slotsQuery = useSlots({ limit: 25 })
  const bookingsQuery = useBookings({ limit: 25 })

  if (poolQuery.isPending) {
    return <ResourcePoolDetailSkeleton />
  }

  if (poolQuery.isError) {
    return (
      <ResourceDetailState className={className} message={page.pool.loadFailed} onBack={onBack} />
    )
  }

  const pool = poolQuery.data
  if (!pool) {
    return (
      <ResourceDetailState className={className} message={page.pool.notFound} onBack={onBack} />
    )
  }

  const products = productsQuery.data?.data ?? []
  const resources = resourcesQuery.data?.data ?? []
  const slots = slotsQuery.data?.data ?? []
  const bookings = bookingsQuery.data?.data ?? []
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]))
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]))
  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]))

  return (
    <div data-slot="resource-pool-detail-page" className={cn("flex flex-col gap-6 p-6", className)}>
      <ResourceDetailHeader
        title={pool.name}
        deleteConfirmName={pool.name}
        deleteConfirmTemplate={page.pool.deleteConfirm}
        deleteErrorMessage={page.pool.deleteFailed}
        deleting={deleting}
        confirmAction={confirmAction}
        onBack={onBack}
        onDelete={onDelete ? () => onDelete(pool) : undefined}
        badges={
          <>
            <Badge variant="outline">{m.common.resourceKindLabels[pool.kind]}</Badge>
            <Badge variant={pool.active ? "default" : "secondary"}>
              {pool.active ? m.common.active : m.common.inactive}
            </Badge>
          </>
        }
        actions={
          pool.productId && onOpenProduct ? (
            <Button type="button" variant="outline" onClick={() => onOpenProduct(pool.productId!)}>
              <Package data-icon="inline-start" aria-hidden="true" />
              {page.common.openProduct}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <ResourceDetailCard title={page.pool.detailsTitle}>
          <ResourceDetailField label={page.common.product}>
            {pool.productId ? labelById(products, pool.productId) : page.common.noValue}
          </ResourceDetailField>
          <ResourceDetailField label={page.pool.sharedCapacity}>
            {pool.sharedCapacity ?? page.common.noValue}
          </ResourceDetailField>
          <ResourceDetailField label={page.common.created}>
            {i18n.formatDateTime(pool.createdAt)}
          </ResourceDetailField>
          <ResourceDetailField label={page.common.updated}>
            {i18n.formatDateTime(pool.updatedAt)}
          </ResourceDetailField>
        </ResourceDetailCard>

        {pool.notes ? (
          <ResourceDetailCard title={page.common.notes}>
            <p className="whitespace-pre-wrap">{pool.notes}</p>
          </ResourceDetailCard>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Users className="size-4" aria-hidden="true" />
          <CardTitle>{page.pool.membersTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {(membersQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{page.pool.membersEmpty}</p>
          ) : (
            membersQuery.data?.data.map((member) => {
              const resource = resourcesById.get(member.resourceId)
              const body = (
                <>
                  <div className="font-medium">{resource?.name ?? member.resourceId}</div>
                  <div className="text-muted-foreground">
                    {resource ? m.common.resourceKindLabels[resource.kind] : page.pool.noResource}
                    {" · "}
                    {resource?.active ? m.common.active : m.common.inactive}
                  </div>
                </>
              )

              return onOpenResource && resource ? (
                <button
                  key={member.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() => onOpenResource(resource.id)}
                >
                  {body}
                </button>
              ) : (
                <div key={member.id} className="rounded-md border p-3">
                  {body}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Package className="size-4" aria-hidden="true" />
          <CardTitle>{page.pool.allocationsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {(allocationsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{page.pool.allocationsEmpty}</p>
          ) : (
            allocationsQuery.data?.data.map((allocation) => (
              <PoolAllocationSummary
                key={allocation.id}
                allocation={allocation}
                onOpenAllocation={onOpenAllocation}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Wrench className="size-4" aria-hidden="true" />
          <CardTitle>{page.pool.liveAssignmentsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {(assignmentsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{page.pool.liveAssignmentsEmpty}</p>
          ) : (
            assignmentsQuery.data?.data.map((assignment) => (
              <ResourceAssignmentSummary
                key={assignment.id}
                assignment={assignment}
                bookingLabel={
                  bookingsById.get(assignment.bookingId ?? "")?.bookingNumber ??
                  assignment.bookingId ??
                  page.common.noBooking
                }
                noValue={page.common.noValue}
                slotLabel={
                  slotsById.get(assignment.slotId)
                    ? formatResourceSlotLabel(slotsById.get(assignment.slotId)!, {
                        template: m.common.slotLabel,
                        formatDate: i18n.formatDate,
                      })
                    : assignment.slotId
                }
                onOpenAssignment={onOpenAssignment}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function PoolAllocationSummary({
  allocation,
  onOpenAllocation,
}: {
  allocation: ResourceAllocationRow
  onOpenAllocation?: (allocationId: string) => void
}) {
  const i18n = useResourcesUiI18nOrDefault()
  const m = i18n.messages
  const page = m.detailPages
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{m.common.allocationModeLabels[allocation.allocationMode]}</Badge>
        <span>
          {page.common.quantity} {i18n.formatNumber(allocation.quantityRequired)}
        </span>
      </div>
      <div className="mt-2 text-muted-foreground">
        {page.common.product}: {allocation.productId}
      </div>
      <div className="text-muted-foreground">
        {page.allocation.rule}: {allocation.availabilityRuleId ?? page.common.noRule}
        {" · "}
        {page.allocation.startTime}: {allocation.startTimeId ?? page.common.noStartTime}
        {" · "}
        {page.allocation.priority}: {i18n.formatNumber(allocation.priority)}
      </div>
    </>
  )

  if (!onOpenAllocation) {
    return <div className="rounded-md border p-3">{content}</div>
  }

  return (
    <button
      type="button"
      className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
      onClick={() => onOpenAllocation(allocation.id)}
    >
      {content}
    </button>
  )
}
