"use client"

import { Badge, Button, cn } from "@voyant-travel/ui/components"
import { Package, Wrench } from "lucide-react"
import { useResourcesUiI18nOrDefault } from "../i18n/index.js"
import {
  labelById,
  type ResourceAllocationDetail,
  useAllocation,
  usePool,
  useProducts,
  useRules,
  useStartTimes,
} from "../index.js"
import {
  type ConfirmAction,
  ResourceDetailCard,
  ResourceDetailField,
  ResourceDetailHeader,
  ResourceDetailState,
} from "./resource-detail-shared.js"
import { ResourceAllocationDetailSkeleton } from "./resource-detail-skeletons.js"

// The skeleton lives in `./resource-detail-skeletons.js` — a lean module —
// so the resources admin extension factory can attach it as a
// `pendingComponent` without pinning this page module into the workspace
// chrome chunk. Re-exported here for backwards compatibility.
export { ResourceAllocationDetailSkeleton }

export interface ResourceAllocationDetailPageProps {
  id: string
  className?: string
  deleting?: boolean
  onBack?: () => void
  onDelete?: (allocation: ResourceAllocationDetail) => Promise<void> | void
  onEdit?: (allocation: ResourceAllocationDetail) => void
  onOpenPool?: (poolId: string) => void
  onOpenProduct?: (productId: string) => void
  confirmAction?: ConfirmAction
}

export function ResourceAllocationDetailPage({
  className,
  confirmAction,
  deleting,
  id,
  onBack,
  onDelete,
  onEdit,
  onOpenPool,
  onOpenProduct,
}: ResourceAllocationDetailPageProps) {
  const i18n = useResourcesUiI18nOrDefault()
  const m = i18n.messages
  const page = m.detailPages
  const allocationQuery = useAllocation(id)
  const allocation = allocationQuery.data
  const poolQuery = usePool(allocation?.poolId)
  const productsQuery = useProducts({ limit: 25 })
  const rulesQuery = useRules({
    enabled: Boolean(allocation?.productId),
    productId: allocation?.productId,
    limit: 25,
  })
  const startTimesQuery = useStartTimes({
    enabled: Boolean(allocation?.productId),
    productId: allocation?.productId,
    limit: 25,
  })

  if (allocationQuery.isPending) {
    return <ResourceAllocationDetailSkeleton />
  }

  if (allocationQuery.isError) {
    return (
      <ResourceDetailState
        className={className}
        message={page.allocation.loadFailed}
        onBack={onBack}
      />
    )
  }

  if (!allocation) {
    return (
      <ResourceDetailState
        className={className}
        message={page.allocation.notFound}
        onBack={onBack}
      />
    )
  }

  const rule = rulesQuery.data?.data.find((entry) => entry.id === allocation.availabilityRuleId)
  const startTime = startTimesQuery.data?.data.find((entry) => entry.id === allocation.startTimeId)

  return (
    <div
      data-slot="resource-allocation-detail-page"
      className={cn("flex flex-col gap-6 p-6", className)}
    >
      <ResourceDetailHeader
        title={page.allocation.pageTitle}
        deleteConfirmName={allocation.id}
        deleteConfirmTemplate={page.allocation.deleteConfirm}
        deleteErrorMessage={page.allocation.deleteFailed}
        deleting={deleting}
        confirmAction={confirmAction}
        onBack={onBack}
        onDelete={onDelete ? () => onDelete(allocation) : undefined}
        onEdit={onEdit ? () => onEdit(allocation) : undefined}
        badges={
          <>
            <Badge variant="outline">
              {m.common.allocationModeLabels[allocation.allocationMode]}
            </Badge>
            <Badge variant="secondary">
              {page.common.quantity} {i18n.formatNumber(allocation.quantityRequired)}
            </Badge>
          </>
        }
        actions={
          <>
            {onOpenPool ? (
              <Button type="button" variant="outline" onClick={() => onOpenPool(allocation.poolId)}>
                <Wrench data-icon="inline-start" aria-hidden="true" />
                {page.common.openPool}
              </Button>
            ) : null}
            {onOpenProduct ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenProduct(allocation.productId)}
              >
                <Package data-icon="inline-start" aria-hidden="true" />
                {page.common.openProduct}
              </Button>
            ) : null}
          </>
        }
      />

      <ResourceDetailCard title={page.allocation.detailsTitle}>
        <div className="grid gap-3 md:grid-cols-2">
          <ResourceDetailField label={page.common.pool}>
            {poolQuery.data?.name ?? allocation.poolId}
          </ResourceDetailField>
          <ResourceDetailField label={page.common.product}>
            {labelById(productsQuery.data?.data ?? [], allocation.productId) ||
              allocation.productId}
          </ResourceDetailField>
          <ResourceDetailField label={page.allocation.rule}>
            {rule?.recurrenceRule ?? allocation.availabilityRuleId ?? page.common.noRule}
          </ResourceDetailField>
          <ResourceDetailField label={page.allocation.startTime}>
            {startTime?.label ??
              startTime?.startTimeLocal ??
              allocation.startTimeId ??
              page.common.noStartTime}
          </ResourceDetailField>
          <ResourceDetailField label={page.allocation.priority}>
            {i18n.formatNumber(allocation.priority)}
          </ResourceDetailField>
          <ResourceDetailField label={page.common.created}>
            {i18n.formatDateTime(allocation.createdAt)}
          </ResourceDetailField>
          <ResourceDetailField label={page.common.updated}>
            {i18n.formatDateTime(allocation.updatedAt)}
          </ResourceDetailField>
        </div>
      </ResourceDetailCard>
    </div>
  )
}
