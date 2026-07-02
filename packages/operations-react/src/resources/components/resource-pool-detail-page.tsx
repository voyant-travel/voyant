"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components"
import { Loader2, Package, Plus, Trash2, Users, Wrench } from "lucide-react"
import { useState } from "react"
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
import type { ResourcePoolMemberRow } from "./resource-detail-data.js"
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
  onEdit?: (pool: ResourcePoolDetail) => void
  onAddMember?: (pool: ResourcePoolDetail, resourceId: string) => Promise<void> | void
  onRemoveMember?: (member: ResourcePoolMemberRow) => Promise<void> | void
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
  onEdit,
  onAddMember,
  onOpenAllocation,
  onOpenAssignment,
  onOpenProduct,
  onOpenResource,
  onRemoveMember,
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
  const [selectedResourceId, setSelectedResourceId] = useState("")
  const [memberMutationId, setMemberMutationId] = useState<string | null>(null)

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
  const members = membersQuery.data?.data ?? []
  const memberResourceIds = new Set(members.map((member) => member.resourceId))
  const addableResources = resources.filter((resource) => !memberResourceIds.has(resource.id))

  async function handleAddMember() {
    if (!onAddMember || !selectedResourceId) return
    setMemberMutationId("add")
    try {
      await onAddMember(pool, selectedResourceId)
      setSelectedResourceId("")
    } finally {
      setMemberMutationId(null)
    }
  }

  async function handleRemoveMember(member: ResourcePoolMemberRow) {
    if (!onRemoveMember) return
    setMemberMutationId(member.id)
    try {
      await onRemoveMember(member)
    } finally {
      setMemberMutationId(null)
    }
  }

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
        onEdit={onEdit ? () => onEdit(pool) : undefined}
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
          {onAddMember ? (
            <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
              <Select
                value={selectedResourceId}
                onValueChange={(value) => setSelectedResourceId(value ?? "")}
              >
                <SelectTrigger className="min-w-0 flex-1">
                  <SelectValue placeholder={page.pool.addMemberPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {addableResources.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      {page.pool.memberAlreadyAssigned}
                    </SelectItem>
                  ) : (
                    addableResources.map((resource) => (
                      <SelectItem key={resource.id} value={resource.id}>
                        {resource.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={() => void handleAddMember()}
                disabled={!selectedResourceId || memberMutationId === "add"}
              >
                {memberMutationId === "add" ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />
                ) : (
                  <Plus data-icon="inline-start" aria-hidden="true" />
                )}
                {page.pool.addMember}
              </Button>
            </div>
          ) : null}
          {members.length === 0 ? (
            <p className="text-muted-foreground">{page.pool.membersEmpty}</p>
          ) : (
            members.map((member) => {
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

              return (
                <div key={member.id} className="flex items-start gap-2 rounded-md border p-3">
                  {onOpenResource && resource ? (
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left hover:text-primary"
                      onClick={() => onOpenResource(resource.id)}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">{body}</div>
                  )}
                  {onRemoveMember ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRemoveMember(member)}
                      disabled={memberMutationId === member.id}
                    >
                      {memberMutationId === member.id ? (
                        <Loader2
                          data-icon="inline-start"
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Trash2 data-icon="inline-start" aria-hidden="true" />
                      )}
                      {page.pool.removeMember}
                    </Button>
                  ) : null}
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
                        products,
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
