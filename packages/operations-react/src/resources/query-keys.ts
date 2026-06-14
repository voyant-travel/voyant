export interface PaginationFilters {
  limit?: number | undefined
  offset?: number | undefined
}

export interface ResourceEntityListFilters extends PaginationFilters {
  search?: string | undefined
  active?: boolean | undefined
}

export interface SlotsListFilters extends PaginationFilters {
  productId?: string | undefined
}

export interface RulesListFilters extends PaginationFilters {
  productId?: string | undefined
}

export interface StartTimesListFilters extends PaginationFilters {
  productId?: string | undefined
}

export interface ResourcesListFilters extends ResourceEntityListFilters {
  supplierId?: string | undefined
  kind?: string | undefined
}

export interface ResourcePoolsListFilters extends ResourceEntityListFilters {
  productId?: string | undefined
  kind?: string | undefined
}

export interface ResourceAllocationsListFilters extends PaginationFilters {
  poolId?: string | undefined
  productId?: string | undefined
  availabilityRuleId?: string | undefined
  startTimeId?: string | undefined
  allocationMode?: string | undefined
}

export interface ResourceAssignmentsListFilters extends PaginationFilters {
  slotId?: string | undefined
  poolId?: string | undefined
  resourceId?: string | undefined
  bookingId?: string | undefined
  status?: string | undefined
}

export interface ResourceCloseoutsListFilters extends PaginationFilters {
  resourceId?: string | undefined
  dateLocal?: string | undefined
}

export const resourcesQueryKeys = {
  all: ["voyant", "resources"] as const,

  suppliers: () => [...resourcesQueryKeys.all, "suppliers"] as const,
  suppliersList: (filters: PaginationFilters) =>
    [...resourcesQueryKeys.suppliers(), "list", filters] as const,

  products: () => [...resourcesQueryKeys.all, "products"] as const,
  productsList: (filters: PaginationFilters) =>
    [...resourcesQueryKeys.products(), "list", filters] as const,

  bookings: () => [...resourcesQueryKeys.all, "bookings"] as const,
  bookingsList: (filters: PaginationFilters) =>
    [...resourcesQueryKeys.bookings(), "list", filters] as const,

  slots: () => [...resourcesQueryKeys.all, "slots"] as const,
  slotsList: (filters: SlotsListFilters) =>
    [...resourcesQueryKeys.slots(), "list", filters] as const,

  rules: () => [...resourcesQueryKeys.all, "rules"] as const,
  rulesList: (filters: RulesListFilters) =>
    [...resourcesQueryKeys.rules(), "list", filters] as const,

  startTimes: () => [...resourcesQueryKeys.all, "start-times"] as const,
  startTimesList: (filters: StartTimesListFilters) =>
    [...resourcesQueryKeys.startTimes(), "list", filters] as const,

  resources: () => [...resourcesQueryKeys.all, "resources"] as const,
  resourcesList: (filters: ResourcesListFilters) =>
    [...resourcesQueryKeys.resources(), "list", filters] as const,
  resource: (id: string) => [...resourcesQueryKeys.resources(), "detail", id] as const,

  pools: () => [...resourcesQueryKeys.all, "pools"] as const,
  poolsList: (filters: ResourcePoolsListFilters) =>
    [...resourcesQueryKeys.pools(), "list", filters] as const,
  pool: (id: string) => [...resourcesQueryKeys.pools(), "detail", id] as const,

  allocations: () => [...resourcesQueryKeys.all, "allocations"] as const,
  allocationsList: (filters: ResourceAllocationsListFilters) =>
    [...resourcesQueryKeys.allocations(), "list", filters] as const,
  allocation: (id: string) => [...resourcesQueryKeys.allocations(), "detail", id] as const,

  assignments: () => [...resourcesQueryKeys.all, "assignments"] as const,
  assignmentsList: (filters: ResourceAssignmentsListFilters) =>
    [...resourcesQueryKeys.assignments(), "list", filters] as const,
  assignment: (id: string) => [...resourcesQueryKeys.assignments(), "detail", id] as const,

  closeouts: () => [...resourcesQueryKeys.all, "closeouts"] as const,
  closeoutsList: (filters: ResourceCloseoutsListFilters) =>
    [...resourcesQueryKeys.closeouts(), "list", filters] as const,
} as const
