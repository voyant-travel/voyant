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
import { formatDateTimeOrFallback, formatResourceSlotLabel } from "../i18n/utils.js"
import {
  labelById,
  type ResourceDetail,
  type ResourcePoolRow,
  type ResourceSlotAssignmentRow,
  useAssignments,
  useBookings,
  useCloseouts,
  usePools,
  useProducts,
  useResource,
  useSlots,
  useSuppliers,
} from "../index.js"
import { useResourcePoolMembers } from "./resource-detail-data.js"
import {
  type ConfirmAction,
  ResourceDetailCard,
  ResourceDetailField,
  ResourceDetailHeader,
  ResourceDetailState,
} from "./resource-detail-shared.js"
import { ResourceDetailSkeleton } from "./resource-detail-skeletons.js"

// The skeleton lives in `./resource-detail-skeletons.js` — a lean module —
// so the resources admin extension factory can attach it as a
// `pendingComponent` without pinning this page module into the workspace
// chrome chunk. Re-exported here for backwards compatibility.
export { ResourceDetailSkeleton }

export interface ResourceDetailPageProps {
  id: string
  className?: string
  deleting?: boolean
  onBack?: () => void
  onDelete?: (resource: ResourceDetail) => Promise<void> | void
  onEdit?: (resource: ResourceDetail) => void
  onOpenSupplier?: (supplierId: string) => void
  onOpenAssignment?: (assignmentId: string) => void
  confirmAction?: ConfirmAction
}

export function ResourceDetailPage({
  className,
  confirmAction,
  deleting,
  id,
  onBack,
  onDelete,
  onEdit,
  onOpenAssignment,
  onOpenSupplier,
}: ResourceDetailPageProps) {
  const i18n = useResourcesUiI18nOrDefault()
  const m = i18n.messages
  const page = m.detailPages
  const resourceQuery = useResource(id)
  const suppliersQuery = useSuppliers({ limit: 25 })
  const poolMembersQuery = useResourcePoolMembers({ resourceId: id, limit: 25 })
  const poolsQuery = usePools({ limit: 25 })
  const assignmentsQuery = useAssignmentsByResource(id)
  const slotsQuery = useSlots({ limit: 25 })
  const bookingsQuery = useBookings({ limit: 25 })
  const productsQuery = useProducts({ limit: 25 })
  const closeoutsQuery = useCloseouts({ resourceId: id, limit: 25 })

  if (resourceQuery.isPending) {
    return <ResourceDetailSkeleton />
  }

  if (resourceQuery.isError) {
    return (
      <ResourceDetailState
        className={className}
        message={page.resource.loadFailed}
        onBack={onBack}
      />
    )
  }

  const resource = resourceQuery.data
  if (!resource) {
    return (
      <ResourceDetailState className={className} message={page.resource.notFound} onBack={onBack} />
    )
  }

  const pools = poolsQuery.data?.data ?? []
  const slots = slotsQuery.data?.data ?? []
  const bookings = bookingsQuery.data?.data ?? []
  const products = productsQuery.data?.data ?? []
  const poolsById = new Map(pools.map((pool) => [pool.id, pool]))
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]))
  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]))
  const supplierLabel = resource.supplierId
    ? labelById(suppliersQuery.data?.data ?? [], resource.supplierId)
    : page.resource.noSupplierAssigned

  return (
    <div data-slot="resource-detail-page" className={cn("flex flex-col gap-6 p-6", className)}>
      <ResourceDetailHeader
        title={resource.name}
        deleteConfirmName={resource.name}
        deleteConfirmTemplate={page.resource.deleteConfirm}
        deleteErrorMessage={page.resource.deleteFailed}
        deleting={deleting}
        confirmAction={confirmAction}
        onBack={onBack}
        onDelete={onDelete ? () => onDelete(resource) : undefined}
        onEdit={onEdit ? () => onEdit(resource) : undefined}
        badges={
          <>
            <Badge variant="outline">{m.common.resourceKindLabels[resource.kind]}</Badge>
            <Badge variant={resource.active ? "default" : "secondary"}>
              {resource.active ? m.common.active : m.common.inactive}
            </Badge>
          </>
        }
        actions={
          resource.supplierId && onOpenSupplier ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenSupplier(resource.supplierId!)}
            >
              <Users data-icon="inline-start" aria-hidden="true" />
              {page.common.openSupplier}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <ResourceDetailCard title={page.resource.detailsTitle}>
          <ResourceDetailField label={page.common.supplier}>{supplierLabel}</ResourceDetailField>
          <ResourceDetailField label={page.common.code}>
            {resource.code ?? page.common.noValue}
          </ResourceDetailField>
          <ResourceDetailField label={page.common.capacity}>
            {resource.capacity ?? page.common.noValue}
          </ResourceDetailField>
          <ResourceDetailField label={page.common.created}>
            {i18n.formatDateTime(resource.createdAt)}
          </ResourceDetailField>
          <ResourceDetailField label={page.common.updated}>
            {i18n.formatDateTime(resource.updatedAt)}
          </ResourceDetailField>
        </ResourceDetailCard>

        {resource.notes ? (
          <ResourceDetailCard title={page.common.notes}>
            <p className="whitespace-pre-wrap">{resource.notes}</p>
          </ResourceDetailCard>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Package className="size-4" aria-hidden="true" />
          <CardTitle>{page.resource.poolMembershipsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {(poolMembersQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{page.resource.poolMembershipsEmpty}</p>
          ) : (
            poolMembersQuery.data?.data.map((member) => {
              const pool = poolsById.get(member.poolId)
              return (
                <div key={member.id} className="rounded-md border p-3">
                  <div className="font-medium">{pool?.name ?? member.poolId}</div>
                  <div className="text-muted-foreground">
                    {page.common.product}: {pool?.productId ?? page.common.noValue}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Wrench className="size-4" aria-hidden="true" />
          <CardTitle>{page.resource.assignmentsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {(assignmentsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{page.resource.assignmentsEmpty}</p>
          ) : (
            assignmentsQuery.data?.data.map((assignment) => (
              <ResourceAssignmentSummary
                key={assignment.id}
                assignment={assignment}
                pool={undefined}
                slotLabel={
                  slotsById.get(assignment.slotId)
                    ? formatResourceSlotLabel(slotsById.get(assignment.slotId)!, {
                        template: m.common.slotLabel,
                        formatDate: i18n.formatDate,
                        products,
                      })
                    : assignment.slotId
                }
                bookingLabel={
                  bookingsById.get(assignment.bookingId ?? "")?.bookingNumber ??
                  assignment.bookingId ??
                  page.common.noBooking
                }
                noValue={page.common.noValue}
                onOpenAssignment={onOpenAssignment}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{page.resource.closeoutsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {(closeoutsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{page.resource.closeoutsEmpty}</p>
          ) : (
            closeoutsQuery.data?.data.map((closeout) => (
              <div key={closeout.id} className="rounded-md border p-3">
                <div className="font-medium">{closeout.dateLocal}</div>
                <div className="text-muted-foreground">
                  {formatDateTimeOrFallback(closeout.startsAt, {
                    fallback: page.common.noValue,
                    formatDateTime: i18n.formatDateTime,
                  })}{" "}
                  {page.common.to}{" "}
                  {formatDateTimeOrFallback(closeout.endsAt, {
                    fallback: page.common.noValue,
                    formatDateTime: i18n.formatDateTime,
                  })}
                </div>
                <div className="text-muted-foreground">
                  {page.resource.createdBy}: {closeout.createdBy ?? page.common.noValue}
                </div>
                {closeout.reason ? (
                  <div className="mt-2 whitespace-pre-wrap">{closeout.reason}</div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function useAssignmentsByResource(resourceId: string) {
  return useAssignments({ resourceId, limit: 25 })
}

export function ResourceAssignmentSummary({
  assignment,
  bookingLabel,
  noValue,
  onOpenAssignment,
  pool,
  slotLabel,
}: {
  assignment: ResourceSlotAssignmentRow
  bookingLabel: string
  noValue: string
  onOpenAssignment?: (assignmentId: string) => void
  pool?: ResourcePoolRow | undefined
  slotLabel: string
}) {
  const i18n = useResourcesUiI18nOrDefault()
  const m = i18n.messages
  const page = m.detailPages
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{m.common.assignmentStatusLabels[assignment.status]}</Badge>
        <span>{slotLabel}</span>
      </div>
      <div className="mt-2 text-muted-foreground">
        {page.common.booking}: {bookingLabel}
      </div>
      {pool ? (
        <div className="text-muted-foreground">
          {page.common.pool}: {pool.name}
        </div>
      ) : null}
      <div className="text-muted-foreground">
        {page.resource.assignedBy}: {assignment.assignedBy ?? noValue}
        {" · "}
        {page.resource.released}:{" "}
        {formatDateTimeOrFallback(assignment.releasedAt, {
          fallback: noValue,
          formatDateTime: i18n.formatDateTime,
        })}
      </div>
      {assignment.notes ? <div className="mt-2 whitespace-pre-wrap">{assignment.notes}</div> : null}
    </>
  )

  if (!onOpenAssignment) {
    return <div className="rounded-md border p-3">{content}</div>
  }

  return (
    <button
      type="button"
      className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
      onClick={() => onOpenAssignment(assignment.id)}
    >
      {content}
    </button>
  )
}
