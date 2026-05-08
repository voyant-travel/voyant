import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { RowSelectionState } from "@tanstack/react-table"
import { formatMessage } from "@voyantjs/admin"
import { ResourcesOverview } from "@voyantjs/resources-ui/components/resources-overview"
import {
  AllocationsTab,
  PoolsTab,
  ResourcesTab,
} from "@voyantjs/resources-ui/components/resources-tabs-primary"
import {
  AssignmentsTab,
  CloseoutsTab,
} from "@voyantjs/resources-ui/components/resources-tabs-secondary"
import { Tabs, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { useState } from "react"
import { toast } from "sonner"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { ResourcesDialogs } from "./resources-page-dialogs"
import { ResourcesBodySkeleton } from "./resources-page-skeleton"
import type {
  BatchMutationResponse,
  ResourceAllocationRow,
  ResourceCloseoutRow,
  ResourcePoolRow,
  ResourceRow,
  ResourceSlotAssignmentRow,
} from "./resources-shared"
import {
  formatLocalizedSelectionLabel,
  getResourceAllocationsQueryOptions,
  getResourceAssignmentsQueryOptions,
  getResourceBookingsQueryOptions,
  getResourceCloseoutsQueryOptions,
  getResourcePoolsQueryOptions,
  getResourceProductsQueryOptions,
  getResourceResourcesQueryOptions,
  getResourceRulesQueryOptions,
  getResourceSlotsQueryOptions,
  getResourceStartTimesQueryOptions,
  getResourceSuppliersQueryOptions,
  labelById,
  slotLabel,
} from "./resources-shared"

export function ResourcesPage() {
  const navigate = useNavigate()
  const messages = useAdminMessages()
  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState("all")
  const [bulkActionTarget, setBulkActionTarget] = useState<string | null>(null)
  const [resourceSelection, setResourceSelection] = useState<RowSelectionState>({})
  const [poolSelection, setPoolSelection] = useState<RowSelectionState>({})
  const [allocationSelection, setAllocationSelection] = useState<RowSelectionState>({})
  const [assignmentSelection, setAssignmentSelection] = useState<RowSelectionState>({})
  const [closeoutSelection, setCloseoutSelection] = useState<RowSelectionState>({})
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

  const suppliersQuery = useQuery(getResourceSuppliersQueryOptions())
  const productsQuery = useQuery(getResourceProductsQueryOptions())
  const bookingsQuery = useQuery(getResourceBookingsQueryOptions())
  const slotsQuery = useQuery(getResourceSlotsQueryOptions())
  const rulesQuery = useQuery(getResourceRulesQueryOptions())
  const startTimesQuery = useQuery(getResourceStartTimesQueryOptions())
  const resourcesQuery = useQuery(getResourceResourcesQueryOptions())
  const poolsQuery = useQuery(getResourcePoolsQueryOptions())
  const allocationsQuery = useQuery(getResourceAllocationsQueryOptions())
  const assignmentsQuery = useQuery(getResourceAssignmentsQueryOptions())
  const closeoutsQuery = useQuery(getResourceCloseoutsQueryOptions())

  const suppliers = suppliersQuery.data?.data ?? []
  const products = productsQuery.data?.data ?? []
  const bookings = bookingsQuery.data?.data ?? []
  const slots = slotsQuery.data?.data ?? []
  const rules = rulesQuery.data?.data ?? []
  const startTimes = startTimesQuery.data?.data ?? []
  const resources = resourcesQuery.data?.data ?? []
  const pools = poolsQuery.data?.data ?? []
  const allocations = allocationsQuery.data?.data ?? []
  const assignments = assignmentsQuery.data?.data ?? []
  const closeouts = closeoutsQuery.data?.data ?? []
  const normalizedSearch = search.trim().toLowerCase()
  const matchesSearch = (...values: Array<string | number | null | undefined>) =>
    !normalizedSearch ||
    values.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(normalizedSearch),
    )
  const matchesKind = (kind: ResourceRow["kind"]) => kindFilter === "all" || kind === kindFilter

  const filteredResources = resources.filter(
    (resource) =>
      matchesKind(resource.kind) &&
      matchesSearch(
        resource.name,
        resource.code,
        resource.kind,
        labelById(suppliers, resource.supplierId),
        resource.notes,
      ),
  )
  const filteredPools = pools.filter(
    (pool) =>
      matchesKind(pool.kind) &&
      matchesSearch(pool.name, pool.kind, labelById(products, pool.productId), pool.notes),
  )
  const filteredAllocations = allocations.filter((allocation) => {
    const pool = pools.find((entry) => entry.id === allocation.poolId)
    return (
      (kindFilter === "all" || pool?.kind === kindFilter) &&
      matchesSearch(
        labelById(pools, allocation.poolId),
        labelById(products, allocation.productId),
        allocation.allocationMode,
        allocation.priority,
        allocation.quantityRequired,
        rules.find((rule) => rule.id === allocation.availabilityRuleId)?.recurrenceRule,
        startTimes.find((startTime) => startTime.id === allocation.startTimeId)?.label,
      )
    )
  })
  const filteredAssignments = assignments.filter((assignment) => {
    const resource = resources.find((entry) => entry.id === assignment.resourceId)
    return (
      (kindFilter === "all" || resource?.kind === kindFilter) &&
      matchesSearch(
        assignment.status,
        assignment.assignedBy,
        assignment.notes,
        labelById(resources, assignment.resourceId),
        labelById(bookings, assignment.bookingId),
        slotLabel(
          slots.find((slot) => slot.id === assignment.slotId) ?? {
            id: assignment.slotId,
            productId: "",
            dateLocal: assignment.slotId,
            startsAt: assignment.slotId,
          },
        ),
      )
    )
  })
  const filteredCloseouts = closeouts.filter((closeout) => {
    const resource = resources.find((entry) => entry.id === closeout.resourceId)
    return (
      (kindFilter === "all" || resource?.kind === kindFilter) &&
      matchesSearch(
        labelById(resources, closeout.resourceId),
        closeout.dateLocal,
        closeout.reason,
        closeout.createdBy,
      )
    )
  })
  const liveAssignments = filteredAssignments.filter(
    (assignment) => assignment.status === "reserved" || assignment.status === "assigned",
  )
  const resourcesWithoutSupplier = filteredResources.filter((resource) => !resource.supplierId)
  const unassignedReservations = liveAssignments.filter((assignment) => !assignment.resourceId)
  const hasFilters = search.length > 0 || kindFilter !== "all"

  const isLoading =
    suppliersQuery.isPending ||
    productsQuery.isPending ||
    bookingsQuery.isPending ||
    slotsQuery.isPending ||
    rulesQuery.isPending ||
    startTimesQuery.isPending ||
    resourcesQuery.isPending ||
    poolsQuery.isPending ||
    allocationsQuery.isPending ||
    assignmentsQuery.isPending ||
    closeoutsQuery.isPending

  const refreshAll = async () => {
    await Promise.all([
      resourcesQuery.refetch(),
      poolsQuery.refetch(),
      allocationsQuery.refetch(),
      assignmentsQuery.refetch(),
      closeoutsQuery.refetch(),
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
  }: {
    ids: string[]
    endpoint: string
    target: string
    nounSingular: string
    nounPlural: string
    payload: Record<string, unknown>
    successVerb: string
    clearSelection: () => void
  }) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    const result = await api.post<BatchMutationResponse>(`${endpoint}/batch-update`, {
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
  }: {
    ids: string[]
    endpoint: string
    target: string
    nounSingular: string
    nounPlural: string
    clearSelection: () => void
  }) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    const result = await api.post<BatchMutationResponse>(`${endpoint}/batch-delete`, { ids })

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
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.resources.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.resources.description}</p>
      </div>

      {isLoading ? (
        <ResourcesBodySkeleton />
      ) : (
        <>
          <ResourcesOverview
            bookings={bookings}
            slots={slots}
            closeouts={closeouts}
            filteredResources={filteredResources}
            filteredPools={filteredPools}
            liveAssignments={liveAssignments}
            resourcesWithoutSupplier={resourcesWithoutSupplier}
            unassignedReservations={unassignedReservations}
            search={search}
            setSearch={setSearch}
            kindFilter={kindFilter}
            setKindFilter={setKindFilter}
            hasFilters={hasFilters}
            onClearFilters={() => {
              setSearch("")
              setKindFilter("all")
            }}
            onOpenAssignment={(assignmentId) => {
              void navigate({
                to: "/resources/assignments/$id",
                params: { id: assignmentId },
              })
            }}
            onOpenResource={(resourceId) => {
              void navigate({ to: "/resources/$id", params: { id: resourceId } })
            }}
          />

          <Tabs defaultValue="resources">
            <TabsList>
              <TabsTrigger value="resources">{messages.resources.tabResources}</TabsTrigger>
              <TabsTrigger value="pools">{messages.resources.tabPools}</TabsTrigger>
              <TabsTrigger value="allocations">{messages.resources.tabAllocations}</TabsTrigger>
              <TabsTrigger value="assignments">{messages.resources.tabAssignments}</TabsTrigger>
              <TabsTrigger value="closeouts">{messages.resources.tabCloseouts}</TabsTrigger>
            </TabsList>
            <ResourcesTab
              suppliers={suppliers}
              filteredResources={filteredResources}
              resourceSelection={resourceSelection}
              setResourceSelection={setResourceSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingResource(undefined)
                setResourceDialogOpen(true)
              }}
              onOpenRoute={(resourceId) => {
                void navigate({ to: "/resources/$id", params: { id: resourceId } })
              }}
              onEdit={(row) => {
                setEditingResource(row)
                setResourceDialogOpen(true)
              }}
            />
            <PoolsTab
              products={products}
              filteredPools={filteredPools}
              poolSelection={poolSelection}
              setPoolSelection={setPoolSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingPool(undefined)
                setPoolDialogOpen(true)
              }}
              onOpenRoute={(poolId) => {
                void navigate({ to: "/resources/pools/$id", params: { id: poolId } })
              }}
              onEdit={(row) => {
                setEditingPool(row)
                setPoolDialogOpen(true)
              }}
            />
            <AllocationsTab
              pools={pools}
              products={products}
              filteredAllocations={filteredAllocations}
              allocationSelection={allocationSelection}
              setAllocationSelection={setAllocationSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingAllocation(undefined)
                setAllocationDialogOpen(true)
              }}
              onOpenRoute={(allocationId) => {
                void navigate({ to: "/resources/allocations/$id", params: { id: allocationId } })
              }}
              onEdit={(row) => {
                setEditingAllocation(row)
                setAllocationDialogOpen(true)
              }}
            />
            <AssignmentsTab
              slots={slots}
              resources={resources}
              bookings={bookings}
              filteredAssignments={filteredAssignments}
              assignmentSelection={assignmentSelection}
              setAssignmentSelection={setAssignmentSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingAssignment(undefined)
                setAssignmentDialogOpen(true)
              }}
              onOpenRoute={(assignmentId) => {
                void navigate({ to: "/resources/assignments/$id", params: { id: assignmentId } })
              }}
              onEdit={(row) => {
                setEditingAssignment(row)
                setAssignmentDialogOpen(true)
              }}
            />
            <CloseoutsTab
              resources={resources}
              filteredCloseouts={filteredCloseouts}
              closeoutSelection={closeoutSelection}
              setCloseoutSelection={setCloseoutSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingCloseout(undefined)
                setCloseoutDialogOpen(true)
              }}
              onEdit={(row) => {
                setEditingCloseout(row)
                setCloseoutDialogOpen(true)
              }}
            />
          </Tabs>
        </>
      )}
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
    </div>
  )
}
