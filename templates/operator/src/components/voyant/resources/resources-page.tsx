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
import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
import { Label } from "@voyantjs/ui/components/label"
import { Popover, PopoverContent, PopoverTrigger } from "@voyantjs/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Tabs, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { ListFilter, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge, Button, Input } from "@/components/ui"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { ResourcesDialogs } from "./resources-page-dialogs"
import { ResourcesBodySkeleton } from "./resources-page-skeleton"
import type {
  BatchMutationResponse,
  ProductOption,
  ResourceAllocationRow,
  ResourceCloseoutRow,
  ResourcePoolRow,
  ResourceRow,
  ResourceSlotAssignmentRow,
  SupplierOption,
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
  const [activeTab, setActiveTab] = useState<
    "resources" | "pools" | "allocations" | "assignments" | "closeouts"
  >("resources")
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  // Per-tab dimensions. We keep them at page level so switching tabs doesn't
  // wipe state, and so the kind/search filters at the title row can compose
  // with any tab-specific filters in the popover.
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null)
  const [selectedSupplierOption, setSelectedSupplierOption] = useState<SupplierOption | null>(null)
  const [productFilter, setProductFilter] = useState<string | null>(null)
  const [selectedProductOption, setSelectedProductOption] = useState<ProductOption | null>(null)
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all")
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<string>("all")
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
  const matchesActive = (active: boolean) =>
    activeFilter === "all" ||
    (activeFilter === "active" && active) ||
    (activeFilter === "inactive" && !active)

  const filteredResources = resources.filter(
    (resource) =>
      matchesKind(resource.kind) &&
      matchesActive(resource.active) &&
      (!supplierFilter || resource.supplierId === supplierFilter) &&
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
      matchesActive(pool.active) &&
      (!productFilter || pool.productId === productFilter) &&
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
      (assignmentStatusFilter === "all" || assignment.status === assignmentStatusFilter) &&
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
  const activeFilterCount =
    (kindFilter !== "all" ? 1 : 0) +
    (activeFilter !== "all" ? 1 : 0) +
    (supplierFilter !== null ? 1 : 0) +
    (productFilter !== null ? 1 : 0) +
    (assignmentStatusFilter !== "all" ? 1 : 0)
  const hasFilters = search.length > 0 || activeFilterCount > 0

  const clearAllFilters = () => {
    setSearch("")
    setKindFilter("all")
    setActiveFilter("all")
    setSupplierFilter(null)
    setSelectedSupplierOption(null)
    setProductFilter(null)
    setSelectedProductOption(null)
    setAssignmentStatusFilter("all")
  }

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

  // Kind list is shared across the title-row select. We derive it from the
  // i18n labels record so the enum stays in one place (the i18n package).
  const kindOptions = useMemo(
    () => Object.entries(messages.resources.kindLabels).map(([value, label]) => ({ value, label })),
    [messages],
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{messages.resources.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.resources.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Label htmlFor="resources-search" className="sr-only">
              {messages.resources.searchPlaceholder}
            </Label>
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="resources-search"
              placeholder={messages.resources.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={kindFilter} onValueChange={(value) => setKindFilter(value ?? "all")}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{messages.resources.allKinds}</SelectItem>
              {kindOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline">
                  <ListFilter className="mr-2 size-4" aria-hidden="true" />
                  {messages.resources.filtersButton}
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 px-1.5">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent align="end" className="w-[22rem] p-4">
              <ResourcesFilterPopover
                activeTab={activeTab}
                messages={messages}
                suppliers={suppliers}
                products={products}
                supplierFilter={supplierFilter}
                setSupplierFilter={setSupplierFilter}
                selectedSupplierOption={selectedSupplierOption}
                setSelectedSupplierOption={setSelectedSupplierOption}
                productFilter={productFilter}
                setProductFilter={setProductFilter}
                selectedProductOption={selectedProductOption}
                setSelectedProductOption={setSelectedProductOption}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                assignmentStatusFilter={assignmentStatusFilter}
                setAssignmentStatusFilter={setAssignmentStatusFilter}
              />
            </PopoverContent>
          </Popover>

          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="mr-1 size-4" aria-hidden="true" />
              {messages.resources.clearFilters}
            </Button>
          ) : null}
        </div>
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
            onClearFilters={clearAllFilters}
            onOpenAssignment={(assignmentId) => {
              void navigate({
                to: "/resources/assignments/$id",
                params: { id: assignmentId },
              })
            }}
            onOpenResource={(resourceId) => {
              void navigate({ to: "/resources/$id", params: { id: resourceId } })
            }}
            showFilters={false}
          />

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab((value ?? "resources") as typeof activeTab)}
          >
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

const ASSIGNMENT_STATUSES = ["reserved", "assigned", "released", "completed", "cancelled"] as const

interface ResourcesFilterPopoverProps {
  activeTab: "resources" | "pools" | "allocations" | "assignments" | "closeouts"
  messages: ReturnType<typeof useAdminMessages>
  suppliers: SupplierOption[]
  products: ProductOption[]
  supplierFilter: string | null
  setSupplierFilter: (value: string | null) => void
  selectedSupplierOption: SupplierOption | null
  setSelectedSupplierOption: (value: SupplierOption | null) => void
  productFilter: string | null
  setProductFilter: (value: string | null) => void
  selectedProductOption: ProductOption | null
  setSelectedProductOption: (value: ProductOption | null) => void
  activeFilter: "all" | "active" | "inactive"
  setActiveFilter: (value: "all" | "active" | "inactive") => void
  assignmentStatusFilter: string
  setAssignmentStatusFilter: (value: string) => void
}

/**
 * Popover body with per-tab filter dimensions. The kind/search filters are
 * always visible in the title row; this popover surfaces tab-specific
 * dimensions only — no point showing a "supplier" filter when the user is
 * looking at the Allocations table.
 */
function ResourcesFilterPopover({
  activeTab,
  messages,
  suppliers,
  products,
  supplierFilter,
  setSupplierFilter,
  selectedSupplierOption,
  setSelectedSupplierOption,
  productFilter,
  setProductFilter,
  selectedProductOption,
  setSelectedProductOption,
  activeFilter,
  setActiveFilter,
  assignmentStatusFilter,
  setAssignmentStatusFilter,
}: ResourcesFilterPopoverProps) {
  const f = messages.resources

  const activeStatusSelect = (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="resources-filter-active">{f.filtersActiveLabel}</Label>
      <Select
        value={activeFilter}
        onValueChange={(value) =>
          setActiveFilter((value ?? "all") as "all" | "active" | "inactive")
        }
      >
        <SelectTrigger id="resources-filter-active" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{f.filtersActiveAll}</SelectItem>
          <SelectItem value="active">{f.filtersActiveOnly}</SelectItem>
          <SelectItem value="inactive">{f.filtersInactiveOnly}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  if (activeTab === "resources") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{f.filtersSupplierLabel}</Label>
          <AsyncCombobox<SupplierOption>
            value={supplierFilter}
            onChange={(value) => {
              setSupplierFilter(value)
              if (!value) setSelectedSupplierOption(null)
              else {
                const match = suppliers.find((s) => s.id === value)
                if (match) setSelectedSupplierOption(match)
              }
            }}
            items={suppliers}
            selectedItem={selectedSupplierOption}
            getKey={(s) => s.id}
            getLabel={(s) => s.name}
            placeholder={f.filtersSupplierAny}
            emptyText={f.filtersSupplierEmpty}
            triggerClassName="w-full"
          />
        </div>
        {activeStatusSelect}
      </div>
    )
  }

  if (activeTab === "pools") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{f.filtersProductLabel}</Label>
          <AsyncCombobox<ProductOption>
            value={productFilter}
            onChange={(value) => {
              setProductFilter(value)
              if (!value) setSelectedProductOption(null)
              else {
                const match = products.find((p) => p.id === value)
                if (match) setSelectedProductOption(match)
              }
            }}
            items={products}
            selectedItem={selectedProductOption}
            getKey={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder={f.filtersProductAny}
            emptyText={f.filtersProductEmpty}
            triggerClassName="w-full"
          />
        </div>
        {activeStatusSelect}
      </div>
    )
  }

  if (activeTab === "assignments") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resources-filter-status">{f.filtersStatusLabel}</Label>
          <Select
            value={assignmentStatusFilter}
            onValueChange={(value) => setAssignmentStatusFilter(value ?? "all")}
          >
            <SelectTrigger id="resources-filter-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{f.filtersStatusAll}</SelectItem>
              {ASSIGNMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {f.assignmentStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  // Allocations + closeouts have only kind/search filters today (already in
  // the title row); show a hint so the popover never feels empty.
  return (
    <p className="text-sm text-muted-foreground">
      {/* i18n-literal-ok internal message until product decides on extra dimensions */}
      No additional filters for this tab yet.
    </p>
  )
}
