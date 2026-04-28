import type { ColumnDef } from "@tanstack/react-table"
import {
  allocationModeOptions,
  assignmentStatusOptions,
  type BookingOption,
  defaultFetcher,
  formatDateTime,
  formatSelectionLabel,
  getAllocationsQueryOptions as getAllocationsQueryOptionsBase,
  getAssignmentsQueryOptions as getAssignmentsQueryOptionsBase,
  getBookingsQueryOptions as getBookingsQueryOptionsBase,
  getCloseoutsQueryOptions as getCloseoutsQueryOptionsBase,
  getPoolsQueryOptions as getPoolsQueryOptionsBase,
  getProductsQueryOptions as getProductsQueryOptionsBase,
  getResourcesQueryOptions as getResourcesQueryOptionsBase,
  getRulesQueryOptions as getRulesQueryOptionsBase,
  getSlotsQueryOptions as getSlotsQueryOptionsBase,
  getStartTimesQueryOptions as getStartTimesQueryOptionsBase,
  getSuppliersQueryOptions as getSuppliersQueryOptionsBase,
  labelById,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  type ProductOption,
  type ResourceAllocationRow,
  type ResourceCloseoutRow,
  type ResourcePoolRow,
  type ResourceRow,
  type ResourceSlotAssignmentRow,
  type RuleOption,
  resourceKindOptions,
  type SlotOption,
  type StartTimeOption,
  type SupplierOption,
  slotLabel,
  toIsoDateTime,
  toLocalDateTimeInput,
} from "@voyantjs/resources-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { ExternalLink } from "lucide-react"

export type BatchMutationResponse<T = unknown> = {
  data?: T[]
  deletedIds?: string[]
  total: number
  succeeded: number
  failed: Array<{ id: string; error: string }>
}

const client = { baseUrl: "", fetcher: defaultFetcher }

export type {
  BookingOption,
  ProductOption,
  ResourceAllocationRow,
  ResourceCloseoutRow,
  ResourcePoolRow,
  ResourceRow,
  ResourceSlotAssignmentRow,
  RuleOption,
  SlotOption,
  StartTimeOption,
  SupplierOption,
}
export {
  allocationModeOptions,
  assignmentStatusOptions,
  formatDateTime,
  formatSelectionLabel,
  labelById,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  resourceKindOptions,
  slotLabel,
  toIsoDateTime,
  toLocalDateTimeInput,
}

export const resourceColumns = (
  suppliers: SupplierOption[],
  onView: (resourceId: string) => void,
): ColumnDef<ResourceRow>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Resource" />,
  },
  {
    accessorKey: "kind",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Kind" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.kind}
      </Badge>
    ),
  },
  {
    accessorKey: "supplierId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
    cell: ({ row }) => labelById(suppliers, row.original.supplierId),
  },
  {
    accessorKey: "capacity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Capacity" />,
    cell: ({ row }) => row.original.capacity ?? "-",
  },
  {
    accessorKey: "active",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    id: "view",
    header: "View",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Open
      </Button>
    ),
  },
]

export const poolColumns = (
  products: ProductOption[],
  onView: (poolId: string) => void,
): ColumnDef<ResourcePoolRow>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Pool" />,
  },
  {
    accessorKey: "kind",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Kind" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.kind}
      </Badge>
    ),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => labelById(products, row.original.productId),
  },
  {
    accessorKey: "sharedCapacity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Shared Capacity" />,
    cell: ({ row }) => row.original.sharedCapacity ?? "-",
  },
  {
    id: "view",
    header: "View",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Open
      </Button>
    ),
  },
]

export const allocationColumns = (
  pools: ResourcePoolRow[],
  products: ProductOption[],
  onView: (allocationId: string) => void,
): ColumnDef<ResourceAllocationRow>[] => [
  {
    accessorKey: "poolId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Pool" />,
    cell: ({ row }) => labelById(pools, row.original.poolId),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => labelById(products, row.original.productId),
  },
  {
    accessorKey: "allocationMode",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Mode" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.allocationMode}
      </Badge>
    ),
  },
  {
    accessorKey: "quantityRequired",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Qty Required" />,
  },
  {
    accessorKey: "priority",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Priority" />,
  },
  {
    id: "view",
    header: "View",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Open
      </Button>
    ),
  },
]

export const assignmentColumns = (
  slots: SlotOption[],
  resources: ResourceRow[],
  bookings: BookingOption[],
  onView: (assignmentId: string) => void,
): ColumnDef<ResourceSlotAssignmentRow>[] => [
  {
    accessorKey: "slotId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Slot" />,
    cell: ({ row }) =>
      slotLabel(
        slots.find((slot) => slot.id === row.original.slotId) ?? {
          id: row.original.slotId,
          productId: "",
          dateLocal: row.original.slotId,
          startsAt: row.original.slotId,
        },
      ),
  },
  {
    accessorKey: "resourceId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Resource" />,
    cell: ({ row }) => labelById(resources, row.original.resourceId),
  },
  {
    accessorKey: "bookingId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Booking" />,
    cell: ({ row }) => labelById(bookings, row.original.bookingId),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "releasedAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Released" />,
    cell: ({ row }) => formatDateTime(row.original.releasedAt),
  },
  {
    id: "view",
    header: "View",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Open
      </Button>
    ),
  },
]

export const closeoutColumns = (resources: ResourceRow[]): ColumnDef<ResourceCloseoutRow>[] => [
  {
    accessorKey: "resourceId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Resource" />,
    cell: ({ row }) => labelById(resources, row.original.resourceId),
  },
  {
    accessorKey: "dateLocal",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
  },
  {
    accessorKey: "startsAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Starts" />,
    cell: ({ row }) => formatDateTime(row.original.startsAt),
  },
  {
    accessorKey: "endsAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ends" />,
    cell: ({ row }) => formatDateTime(row.original.endsAt),
  },
  {
    accessorKey: "reason",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Reason" />,
    cell: ({ row }) => row.original.reason ?? "-",
  },
]

export function getResourceSuppliersQueryOptions() {
  return getSuppliersQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getResourceProductsQueryOptions() {
  return getProductsQueryOptionsBase(client, { limit: 100 })
}

export function getResourceBookingsQueryOptions() {
  return getBookingsQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getResourceSlotsQueryOptions() {
  return getSlotsQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getResourceRulesQueryOptions() {
  return getRulesQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getResourceStartTimesQueryOptions() {
  return getStartTimesQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getResourceResourcesQueryOptions() {
  return getResourcesQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getResourcePoolsQueryOptions() {
  return getPoolsQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getResourceAllocationsQueryOptions() {
  return getAllocationsQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getResourceAssignmentsQueryOptions() {
  return getAssignmentsQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getResourceCloseoutsQueryOptions() {
  return getCloseoutsQueryOptionsBase(client, { limit: 25, offset: 0 })
}
