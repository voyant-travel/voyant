"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useAdminNavigate } from "@voyant-travel/admin"
import { useState } from "react"
import { ResourceAllocationDetailPage } from "../components/resource-allocation-detail-page.js"
import { ResourceAssignmentDetailPage } from "../components/resource-assignment-detail-page.js"
import { ResourceDetailPage } from "../components/resource-detail-page.js"
import { ResourcePoolDetailPage } from "../components/resource-pool-detail-page.js"
import {
  resourcesQueryKeys,
  useAllocation,
  useAssignment,
  useBookings,
  usePool,
  usePools,
  useProducts,
  useResource,
  useResources,
  useRules,
  useSlots,
  useStartTimes,
  useSuppliers,
  useVoyantResourcesContext,
} from "../index.js"
import { sendResourcesMutation } from "./resources-admin-api.js"
import { ResourceAllocationDialog } from "./resources-dialog-allocation.js"
import { ResourceDialog, ResourcePoolDialog } from "./resources-dialogs-core.js"
import { ResourceSlotAssignmentDialog } from "./resources-dialogs-ops.js"
import { resourcesPageQueryFilters } from "./resources-page-data.js"

/**
 * Packaged admin hosts for the resource detail pages (packaged-admin RFC
 * Phase 3). Each host binds the canonical detail page to its data wiring
 * (the shared resources provider context) and resolves every cross-route
 * link through semantic destinations — no app RPC client, no host route
 * tree. Deletes go through the module's REST endpoint via the context
 * client, invalidate the affected list, and return to `resource.list`.
 *
 * The hosts take the entity id as a prop, so host route files stay the
 * thin binding layer (`Route.useParams()` → host props) until the RFC §4.2
 * code-based route assembly gives packaged pages a router-agnostic way to
 * read route state.
 */

export interface ResourceDetailHostProps {
  id: string
}

export function ResourceDetailHost({ id }: ResourceDetailHostProps) {
  const navigateTo = useAdminNavigate()
  const queryClient = useQueryClient()
  const client = useVoyantResourcesContext()
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false)
  const resource = useResource(id).data
  const suppliers = useSuppliers(resourcesPageQueryFilters.suppliers).data?.data ?? []

  const refreshResource = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.resources() }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.resource(id) }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.all }),
    ])
  }

  return (
    <>
      <ResourceDetailPage
        id={id}
        onBack={() => navigateTo("resource.list", {})}
        onEdit={() => setResourceDialogOpen(true)}
        onOpenSupplier={(supplierId) => navigateTo("supplier.detail", { supplierId })}
        onOpenAssignment={(assignmentId) =>
          navigateTo("resourceAssignment.detail", { assignmentId })
        }
        onDelete={async (resource) => {
          await sendResourcesMutation(
            client,
            "DELETE",
            `/v1/admin/operations/resources/${resource.id}`,
          )
          await refreshResource()
          navigateTo("resource.list", {})
        }}
      />
      <ResourceDialog
        open={resourceDialogOpen}
        onOpenChange={setResourceDialogOpen}
        resource={resource}
        suppliers={suppliers}
        onSuccess={() => {
          setResourceDialogOpen(false)
          void refreshResource()
        }}
      />
    </>
  )
}

export interface ResourcePoolDetailHostProps {
  id: string
}

export function ResourcePoolDetailHost({ id }: ResourcePoolDetailHostProps) {
  const navigateTo = useAdminNavigate()
  const queryClient = useQueryClient()
  const client = useVoyantResourcesContext()
  const [poolDialogOpen, setPoolDialogOpen] = useState(false)
  const pool = usePool(id).data
  const products = useProducts(resourcesPageQueryFilters.products).data?.data ?? []

  const refreshPool = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.pools() }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.pool(id) }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.resources() }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.all }),
    ])
  }

  return (
    <>
      <ResourcePoolDetailPage
        id={id}
        onBack={() => navigateTo("resource.list", {})}
        onEdit={() => setPoolDialogOpen(true)}
        onAddMember={async (pool, resourceId) => {
          await sendResourcesMutation(client, "POST", "/v1/admin/operations/pool-members", {
            poolId: pool.id,
            resourceId,
          })
          await refreshPool()
        }}
        onRemoveMember={async (member) => {
          await sendResourcesMutation(
            client,
            "DELETE",
            `/v1/admin/operations/pool-members/${member.id}`,
          )
          await refreshPool()
        }}
        onOpenProduct={(productId) => navigateTo("product.detail", { productId })}
        onOpenResource={(resourceId) => navigateTo("resource.detail", { resourceId })}
        onOpenAllocation={(allocationId) =>
          navigateTo("resourceAllocation.detail", { allocationId })
        }
        onOpenAssignment={(assignmentId) =>
          navigateTo("resourceAssignment.detail", { assignmentId })
        }
        onDelete={async (pool) => {
          await sendResourcesMutation(client, "DELETE", `/v1/admin/operations/pools/${pool.id}`)
          await refreshPool()
          navigateTo("resource.list", {})
        }}
      />
      <ResourcePoolDialog
        open={poolDialogOpen}
        onOpenChange={setPoolDialogOpen}
        pool={pool}
        products={products}
        onSuccess={() => {
          setPoolDialogOpen(false)
          void refreshPool()
        }}
      />
    </>
  )
}

export interface ResourceAssignmentDetailHostProps {
  id: string
}

export function ResourceAssignmentDetailHost({ id }: ResourceAssignmentDetailHostProps) {
  const navigateTo = useAdminNavigate()
  const queryClient = useQueryClient()
  const client = useVoyantResourcesContext()
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const assignment = useAssignment(id).data
  const slots = useSlots(resourcesPageQueryFilters.slots).data?.data ?? []
  const pools = usePools(resourcesPageQueryFilters.pools).data?.data ?? []
  const resources = useResources(resourcesPageQueryFilters.resources).data?.data ?? []
  const bookings = useBookings(resourcesPageQueryFilters.bookings).data?.data ?? []
  const products = useProducts(resourcesPageQueryFilters.products).data?.data ?? []

  const refreshAssignment = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.assignments() }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.assignment(id) }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.resources() }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.pools() }),
    ])
  }

  return (
    <>
      <ResourceAssignmentDetailPage
        id={id}
        onBack={() => navigateTo("resource.list", {})}
        onEdit={() => setAssignmentDialogOpen(true)}
        onOpenSlot={(slotId) => navigateTo("availabilitySlot.detail", { slotId })}
        onOpenResource={(resourceId) => navigateTo("resource.detail", { resourceId })}
        onDelete={async (assignment) => {
          await sendResourcesMutation(
            client,
            "DELETE",
            `/v1/admin/operations/slot-assignments/${assignment.id}`,
          )
          await refreshAssignment()
          navigateTo("resource.list", {})
        }}
      />
      <ResourceSlotAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        assignment={assignment}
        slots={slots}
        pools={pools}
        resources={resources}
        bookings={bookings}
        products={products}
        onSuccess={() => {
          setAssignmentDialogOpen(false)
          void refreshAssignment()
        }}
      />
    </>
  )
}

export interface ResourceAllocationDetailHostProps {
  id: string
}

export function ResourceAllocationDetailHost({ id }: ResourceAllocationDetailHostProps) {
  const navigateTo = useAdminNavigate()
  const queryClient = useQueryClient()
  const client = useVoyantResourcesContext()
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false)
  const allocation = useAllocation(id).data
  const pools = usePools(resourcesPageQueryFilters.pools).data?.data ?? []
  const products = useProducts(resourcesPageQueryFilters.products).data?.data ?? []
  const rules = useRules(resourcesPageQueryFilters.rules).data?.data ?? []
  const startTimes = useStartTimes(resourcesPageQueryFilters.startTimes).data?.data ?? []

  const refreshAllocation = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.allocations() }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.allocation(id) }),
      queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.pools() }),
    ])
  }

  return (
    <>
      <ResourceAllocationDetailPage
        id={id}
        onBack={() => navigateTo("resource.list", {})}
        onEdit={() => setAllocationDialogOpen(true)}
        onOpenPool={(poolId) => navigateTo("resourcePool.detail", { poolId })}
        onOpenProduct={(productId) => navigateTo("product.detail", { productId })}
        onDelete={async (allocation) => {
          await sendResourcesMutation(
            client,
            "DELETE",
            `/v1/admin/operations/allocations/${allocation.id}`,
          )
          await refreshAllocation()
          navigateTo("resource.list", {})
        }}
      />
      <ResourceAllocationDialog
        open={allocationDialogOpen}
        onOpenChange={setAllocationDialogOpen}
        allocation={allocation}
        pools={pools}
        products={products}
        rules={rules}
        startTimes={startTimes}
        onSuccess={() => {
          setAllocationDialogOpen(false)
          void refreshAllocation()
        }}
      />
    </>
  )
}
