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
import type { AdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"

export type BatchMutationResponse<T = unknown> = {
  data?: T[]
  deletedIds?: string[]
  total: number
  succeeded: number
  failed: Array<{ id: string; error: string }>
}

const client = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

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

export function formatLocalizedSelectionLabel(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`
}

export function getResourceKindLabel(kind: ResourceRow["kind"], messages: AdminMessages) {
  return messages.resources.kindLabels[kind]
}

export function getAssignmentStatusLabel(
  status: ResourceSlotAssignmentRow["status"],
  messages: AdminMessages,
) {
  return messages.resources.assignmentStatusLabels[status]
}

export function getAllocationModeLabel(
  mode: ResourceAllocationRow["allocationMode"],
  messages: AdminMessages,
) {
  return messages.resources.allocationModeLabels[mode]
}

export const resourceColumns = (
  suppliers: SupplierOption[],
  onView: (resourceId: string) => void,
  messages: AdminMessages,
): ColumnDef<ResourceRow>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.resourceLabel} />
    ),
  },
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.resources.dialogs.resource.kindLabel}
      />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{getResourceKindLabel(row.original.kind, messages)}</Badge>
    ),
  },
  {
    accessorKey: "supplierId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.supplierLabel} />
    ),
    cell: ({ row }) => labelById(suppliers, row.original.supplierId),
  },
  {
    accessorKey: "capacity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.capacityLabel} />
    ),
    cell: ({ row }) => row.original.capacity ?? messages.resources.details.noValue,
  },
  {
    accessorKey: "active",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.statusLabel} />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active ? messages.resources.activeLabel : messages.resources.inactiveLabel}
      </Badge>
    ),
  },
  {
    id: "view",
    header: messages.resources.viewLabel,
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
        {messages.resources.openLabel}
      </Button>
    ),
  },
]

export const poolColumns = (
  products: ProductOption[],
  onView: (poolId: string) => void,
  messages: AdminMessages,
): ColumnDef<ResourcePoolRow>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.poolLabel} />
    ),
  },
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.dialogs.pool.kindLabel} />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{getResourceKindLabel(row.original.kind, messages)}</Badge>
    ),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.productLabel} />
    ),
    cell: ({ row }) => labelById(products, row.original.productId),
  },
  {
    accessorKey: "sharedCapacity",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.resources.dialogs.pool.sharedCapacityLabel}
      />
    ),
    cell: ({ row }) => row.original.sharedCapacity ?? messages.resources.details.noValue,
  },
  {
    id: "view",
    header: messages.resources.viewLabel,
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
        {messages.resources.openLabel}
      </Button>
    ),
  },
]

export const allocationColumns = (
  pools: ResourcePoolRow[],
  products: ProductOption[],
  onView: (allocationId: string) => void,
  messages: AdminMessages,
): ColumnDef<ResourceAllocationRow>[] => [
  {
    accessorKey: "poolId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.poolLabel} />
    ),
    cell: ({ row }) => labelById(pools, row.original.poolId),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.productLabel} />
    ),
    cell: ({ row }) => labelById(products, row.original.productId),
  },
  {
    accessorKey: "allocationMode",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.resources.dialogs.allocation.allocationModeLabel}
      />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {getAllocationModeLabel(row.original.allocationMode, messages)}
      </Badge>
    ),
  },
  {
    accessorKey: "quantityRequired",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.resources.dialogs.allocation.quantityRequiredLabel}
      />
    ),
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.resources.dialogs.allocation.priorityLabel}
      />
    ),
  },
  {
    id: "view",
    header: messages.resources.viewLabel,
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
        {messages.resources.openLabel}
      </Button>
    ),
  },
]

export const assignmentColumns = (
  slots: SlotOption[],
  resources: ResourceRow[],
  bookings: BookingOption[],
  onView: (assignmentId: string) => void,
  messages: AdminMessages,
): ColumnDef<ResourceSlotAssignmentRow>[] => [
  {
    accessorKey: "slotId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.slotLabel} />
    ),
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
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.resourceLabel} />
    ),
    cell: ({ row }) => labelById(resources, row.original.resourceId),
  },
  {
    accessorKey: "bookingId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.bookingLabel} />
    ),
    cell: ({ row }) => labelById(bookings, row.original.bookingId),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.statusLabel} />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{getAssignmentStatusLabel(row.original.status, messages)}</Badge>
    ),
  },
  {
    accessorKey: "releasedAt",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.resources.details.assignment.releasedLabel}
      />
    ),
    cell: ({ row }) => formatDateTime(row.original.releasedAt),
  },
  {
    id: "view",
    header: messages.resources.viewLabel,
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
        {messages.resources.openLabel}
      </Button>
    ),
  },
]

export const closeoutColumns = (
  resources: ResourceRow[],
  messages: AdminMessages,
): ColumnDef<ResourceCloseoutRow>[] => [
  {
    accessorKey: "resourceId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.resources.resourceLabel} />
    ),
    cell: ({ row }) => labelById(resources, row.original.resourceId),
  },
  {
    accessorKey: "dateLocal",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.resources.dialogs.closeout.dateLabel}
      />
    ),
  },
  {
    accessorKey: "startsAt",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.resources.dialogs.closeout.startsAtLabel}
      />
    ),
    cell: ({ row }) => formatDateTime(row.original.startsAt),
  },
  {
    accessorKey: "endsAt",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.resources.dialogs.closeout.endsAtLabel}
      />
    ),
    cell: ({ row }) => formatDateTime(row.original.endsAt),
  },
  {
    accessorKey: "reason",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.resources.dialogs.closeout.reasonLabel}
      />
    ),
    cell: ({ row }) => row.original.reason ?? messages.resources.details.noValue,
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
