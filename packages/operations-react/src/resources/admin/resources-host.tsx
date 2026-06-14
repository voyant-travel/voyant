"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useAdminNavigate, useOperatorAdminMessages } from "@voyant-travel/admin"
import { formatMessage } from "@voyant-travel/i18n"
import { useState } from "react"
import { toast } from "sonner"
import {
  ResourcesPage,
  type ResourcesPageBulkDeleteArgs,
  type ResourcesPageBulkUpdateArgs,
} from "../components/resources-page.js"
import {
  type ResourceAllocationRow,
  type ResourceCloseoutRow,
  type ResourcePoolRow,
  type ResourceRow,
  type ResourceSlotAssignmentRow,
  resourcesQueryKeys,
  useBookings,
  usePools,
  useProducts,
  useResources,
  useRules,
  useSlots,
  useStartTimes,
  useSuppliers,
  useVoyantResourcesContext,
} from "../index.js"
import { postResourcesBatch } from "./resources-admin-api.js"
import { ResourcesDialogs } from "./resources-dialogs.js"
import { resourcesPageQueryFilters } from "./resources-page-data.js"
import { ResourcesBodySkeleton } from "./resources-page-skeleton.js"

function formatLocalizedSelectionLabel(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`
}

/**
 * Packaged admin host for the resources tab dashboard (packaged-admin RFC
 * Phase 3). Zero-prop: list/filter state stays component-local (no URL
 * search contract), opening a row resolves through the resource semantic
 * destinations, and the create/edit dialogs are the packaged operator-grade
 * {@link ResourcesDialogs} bound to the shared resources provider context.
 * Bulk mutations post the module's `batch-update`/`batch-delete` endpoints
 * through the same context client and refresh via query invalidation.
 */
export function ResourcesHost() {
  const navigateTo = useAdminNavigate()
  const messages = useOperatorAdminMessages()
  const client = useVoyantResourcesContext()
  const queryClient = useQueryClient()

  const [bulkActionTarget, setBulkActionTarget] = useState<string | null>(null)
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false)
  const [poolDialogOpen, setPoolDialogOpen] = useState(false)
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [closeoutDialogOpen, setCloseoutDialogOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<ResourceRow | undefined>()
  const [editingPool, setEditingPool] = useState<ResourcePoolRow | undefined>()
  const [editingAllocation, setEditingAllocation] = useState<ResourceAllocationRow | undefined>()
  const [editingAssignment, setEditingAssignment] = useState<
    ResourceSlotAssignmentRow | undefined
  >()
  const [editingCloseout, setEditingCloseout] = useState<ResourceCloseoutRow | undefined>()

  // Dialog data dimensions. The page runs the same hooks with the same
  // filters internally, so react-query dedupes these into shared cache
  // entries (and the route loader seeds them on SSR).
  const filters = resourcesPageQueryFilters
  const suppliers = useSuppliers(filters.suppliers).data?.data ?? []
  const products = useProducts(filters.products).data?.data ?? []
  const bookings = useBookings(filters.bookings).data?.data ?? []
  const slots = useSlots(filters.slots).data?.data ?? []
  const rules = useRules(filters.rules).data?.data ?? []
  const startTimes = useStartTimes(filters.startTimes).data?.data ?? []
  const resources = useResources(filters.resources).data?.data ?? []
  const pools = usePools(filters.pools).data?.data ?? []

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.resources() }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.pools() }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.allocations() }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.assignments() }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.closeouts() }),
    ])
  }

  const handleBulkUpdate = async ({
    ids,
    endpoint,
    target,
    nounSingular,
    nounPlural,
    payload,
    successVerb,
    clearSelection,
  }: ResourcesPageBulkUpdateArgs) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    const result = await postResourcesBatch(client, `${endpoint}/batch-update`, {
      ids,
      patch: payload,
    })

    await refreshAll()
    clearSelection()
    setBulkActionTarget(null)

    if (result.failed.length === 0) {
      toast.success(
        formatMessage(messages.resources.toasts.bulkUpdated, {
          verb: successVerb,
          selection: formatLocalizedSelectionLabel(result.succeeded, nounSingular, nounPlural),
        }),
      )
      return
    }

    toast.error(
      formatMessage(messages.resources.toasts.bulkUpdatedPartial, {
        verb: successVerb,
        succeeded: result.succeeded,
        selection: formatLocalizedSelectionLabel(result.total, nounSingular, nounPlural),
      }),
    )
  }

  const handleBulkDelete = async ({
    ids,
    endpoint,
    target,
    nounSingular,
    nounPlural,
    clearSelection,
  }: ResourcesPageBulkDeleteArgs) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    const result = await postResourcesBatch(client, `${endpoint}/batch-delete`, { ids })

    await refreshAll()
    clearSelection()
    setBulkActionTarget(null)

    if (result.failed.length === 0) {
      toast.success(
        formatMessage(messages.resources.toasts.bulkDeleted, {
          selection: formatLocalizedSelectionLabel(result.succeeded, nounSingular, nounPlural),
        }),
      )
      return
    }

    toast.error(
      formatMessage(messages.resources.toasts.bulkDeletedPartial, {
        succeeded: result.succeeded,
        selection: formatLocalizedSelectionLabel(result.total, nounSingular, nounPlural),
      }),
    )
  }

  return (
    <ResourcesPage
      queryFilters={filters}
      loadingFallback={<ResourcesBodySkeleton />}
      bulkActionTarget={bulkActionTarget}
      onBulkUpdate={handleBulkUpdate}
      onBulkDelete={handleBulkDelete}
      onResourceCreate={() => {
        setEditingResource(undefined)
        setResourceDialogOpen(true)
      }}
      onResourceOpen={(resourceId) => navigateTo("resource.detail", { resourceId })}
      onResourceEdit={(row) => {
        setEditingResource(row)
        setResourceDialogOpen(true)
      }}
      onPoolCreate={() => {
        setEditingPool(undefined)
        setPoolDialogOpen(true)
      }}
      onPoolOpen={(poolId) => navigateTo("resourcePool.detail", { poolId })}
      onPoolEdit={(row) => {
        setEditingPool(row)
        setPoolDialogOpen(true)
      }}
      onAllocationCreate={() => {
        setEditingAllocation(undefined)
        setAllocationDialogOpen(true)
      }}
      onAllocationOpen={(allocationId) => navigateTo("resourceAllocation.detail", { allocationId })}
      onAllocationEdit={(row) => {
        setEditingAllocation(row)
        setAllocationDialogOpen(true)
      }}
      onAssignmentCreate={() => {
        setEditingAssignment(undefined)
        setAssignmentDialogOpen(true)
      }}
      onAssignmentOpen={(assignmentId) => navigateTo("resourceAssignment.detail", { assignmentId })}
      onAssignmentEdit={(row) => {
        setEditingAssignment(row)
        setAssignmentDialogOpen(true)
      }}
      onCloseoutCreate={() => {
        setEditingCloseout(undefined)
        setCloseoutDialogOpen(true)
      }}
      onCloseoutEdit={(row) => {
        setEditingCloseout(row)
        setCloseoutDialogOpen(true)
      }}
      slots={{
        dialogs: (
          <ResourcesDialogs
            resourceDialogOpen={resourceDialogOpen}
            setResourceDialogOpen={(open) => {
              setResourceDialogOpen(open)
              if (!open) setEditingResource(undefined)
            }}
            editingResource={editingResource}
            poolDialogOpen={poolDialogOpen}
            setPoolDialogOpen={(open) => {
              setPoolDialogOpen(open)
              if (!open) setEditingPool(undefined)
            }}
            editingPool={editingPool}
            allocationDialogOpen={allocationDialogOpen}
            setAllocationDialogOpen={(open) => {
              setAllocationDialogOpen(open)
              if (!open) setEditingAllocation(undefined)
            }}
            editingAllocation={editingAllocation}
            assignmentDialogOpen={assignmentDialogOpen}
            setAssignmentDialogOpen={(open) => {
              setAssignmentDialogOpen(open)
              if (!open) setEditingAssignment(undefined)
            }}
            editingAssignment={editingAssignment}
            closeoutDialogOpen={closeoutDialogOpen}
            setCloseoutDialogOpen={(open) => {
              setCloseoutDialogOpen(open)
              if (!open) setEditingCloseout(undefined)
            }}
            editingCloseout={editingCloseout}
            suppliers={suppliers}
            products={products}
            rules={rules}
            startTimes={startTimes}
            resources={resources}
            pools={pools}
            slots={slots}
            bookings={bookings}
            refreshAll={refreshAll}
          />
        ),
      }}
    />
  )
}
