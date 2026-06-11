"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useAdminNavigate } from "@voyantjs/admin"
import { resourcesQueryKeys, useVoyantResourcesContext } from "@voyantjs/resources-react"

import { ResourceAllocationDetailPage } from "../components/resource-allocation-detail-page.js"
import { ResourceAssignmentDetailPage } from "../components/resource-assignment-detail-page.js"
import { ResourceDetailPage } from "../components/resource-detail-page.js"
import { ResourcePoolDetailPage } from "../components/resource-pool-detail-page.js"
import { sendResourcesMutation } from "./resources-admin-api.js"

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

  return (
    <ResourceDetailPage
      id={id}
      onBack={() => navigateTo("resource.list", {})}
      onOpenSupplier={(supplierId) => navigateTo("supplier.detail", { supplierId })}
      onOpenAssignment={(assignmentId) => navigateTo("resourceAssignment.detail", { assignmentId })}
      onDelete={async (resource) => {
        await sendResourcesMutation(client, "DELETE", `/v1/resources/resources/${resource.id}`)
        await queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.resources() })
        navigateTo("resource.list", {})
      }}
    />
  )
}

export interface ResourcePoolDetailHostProps {
  id: string
}

export function ResourcePoolDetailHost({ id }: ResourcePoolDetailHostProps) {
  const navigateTo = useAdminNavigate()
  const queryClient = useQueryClient()
  const client = useVoyantResourcesContext()

  return (
    <ResourcePoolDetailPage
      id={id}
      onBack={() => navigateTo("resource.list", {})}
      onOpenProduct={(productId) => navigateTo("product.detail", { productId })}
      onOpenResource={(resourceId) => navigateTo("resource.detail", { resourceId })}
      onOpenAllocation={(allocationId) => navigateTo("resourceAllocation.detail", { allocationId })}
      onOpenAssignment={(assignmentId) => navigateTo("resourceAssignment.detail", { assignmentId })}
      onDelete={async (pool) => {
        await sendResourcesMutation(client, "DELETE", `/v1/resources/pools/${pool.id}`)
        await queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.pools() })
        navigateTo("resource.list", {})
      }}
    />
  )
}

export interface ResourceAssignmentDetailHostProps {
  id: string
}

export function ResourceAssignmentDetailHost({ id }: ResourceAssignmentDetailHostProps) {
  const navigateTo = useAdminNavigate()
  const queryClient = useQueryClient()
  const client = useVoyantResourcesContext()

  return (
    <ResourceAssignmentDetailPage
      id={id}
      onBack={() => navigateTo("resource.list", {})}
      onOpenSlot={(slotId) => navigateTo("availabilitySlot.detail", { slotId })}
      onOpenResource={(resourceId) => navigateTo("resource.detail", { resourceId })}
      onDelete={async (assignment) => {
        await sendResourcesMutation(
          client,
          "DELETE",
          `/v1/resources/slot-assignments/${assignment.id}`,
        )
        await queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.assignments() })
        navigateTo("resource.list", {})
      }}
    />
  )
}

export interface ResourceAllocationDetailHostProps {
  id: string
}

export function ResourceAllocationDetailHost({ id }: ResourceAllocationDetailHostProps) {
  const navigateTo = useAdminNavigate()
  const queryClient = useQueryClient()
  const client = useVoyantResourcesContext()

  return (
    <ResourceAllocationDetailPage
      id={id}
      onBack={() => navigateTo("resource.list", {})}
      onOpenPool={(poolId) => navigateTo("resourcePool.detail", { poolId })}
      onOpenProduct={(productId) => navigateTo("product.detail", { productId })}
      onDelete={async (allocation) => {
        await sendResourcesMutation(client, "DELETE", `/v1/resources/allocations/${allocation.id}`)
        await queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.allocations() })
        navigateTo("resource.list", {})
      }}
    />
  )
}
