import type { ColumnDef } from "@tanstack/react-table"
import {
  type AvailabilityCloseoutRow,
  type AvailabilityPickupPointRow,
  type AvailabilityRuleRow,
  type AvailabilitySlotRow,
  type AvailabilityStartTimeRow,
  booleanOptions,
  defaultFetcher,
  formatDateTime,
  formatSelectionLabel,
  getCloseoutsQueryOptions as getCloseoutsQueryOptionsBase,
  getPickupPointsQueryOptions as getPickupPointsQueryOptionsBase,
  getProductsQueryOptions as getProductsQueryOptionsBase,
  getRulesQueryOptions as getRulesQueryOptionsBase,
  getSlotsQueryOptions as getSlotsQueryOptionsBase,
  getStartTimesQueryOptions as getStartTimesQueryOptionsBase,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  type ProductOption,
  productNameById,
  slotStatusOptions,
  slotStatusVariant,
  toIsoDateTime,
  toLocalDateTimeInput,
} from "@voyantjs/availability-react"
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
  AvailabilityCloseoutRow,
  AvailabilityPickupPointRow,
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  AvailabilityStartTimeRow,
  ProductOption,
}
export {
  booleanOptions,
  formatDateTime,
  formatSelectionLabel,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  productNameById,
  slotStatusOptions,
  toIsoDateTime,
  toLocalDateTimeInput,
}

export const ruleColumns = (
  products: ProductOption[],
  onView: (ruleId: string) => void,
): ColumnDef<AvailabilityRuleRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "timezone",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Timezone" />,
  },
  {
    accessorKey: "recurrenceRule",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Recurrence" />,
    cell: ({ row }) => (
      <span className="max-w-[380px] truncate font-mono text-xs">
        {row.original.recurrenceRule}
      </span>
    ),
  },
  {
    accessorKey: "maxCapacity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Max Pax" />,
  },
  {
    accessorKey: "active",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Active" />,
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

export const startTimeColumns = (
  products: ProductOption[],
  onView: (startTimeId: string) => void,
): ColumnDef<AvailabilityStartTimeRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "label",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Label" />,
    cell: ({ row }) => row.original.label ?? "-",
  },
  {
    accessorKey: "startTimeLocal",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Start" />,
  },
  {
    accessorKey: "durationMinutes",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Duration" />,
    cell: ({ row }) =>
      row.original.durationMinutes == null ? "-" : `${row.original.durationMinutes} min`,
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

export const slotColumns = (
  products: ProductOption[],
  onView: (slotId: string) => void,
): ColumnDef<AvailabilitySlotRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "dateLocal",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
  },
  {
    accessorKey: "startsAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Starts At" />,
    cell: ({ row }) => formatDateTime(row.original.startsAt),
  },
  {
    accessorKey: "remainingPax",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Remaining Pax" />,
    cell: ({ row }) => row.original.remainingPax ?? "-",
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant={slotStatusVariant[row.original.status]} className="capitalize">
        {row.original.status.replace("_", " ")}
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

export const closeoutColumns = (
  products: ProductOption[],
): ColumnDef<AvailabilityCloseoutRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "dateLocal",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
  },
  {
    accessorKey: "slotId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Slot" />,
    cell: ({ row }) => row.original.slotId ?? "Product-level",
  },
  {
    accessorKey: "reason",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Reason" />,
    cell: ({ row }) => row.original.reason ?? "-",
  },
]

export const pickupPointColumns = (
  products: ProductOption[],
): ColumnDef<AvailabilityPickupPointRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
  },
  {
    accessorKey: "locationText",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
    cell: ({ row }) => row.original.locationText ?? "-",
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
]

export function getAvailabilityProductsQueryOptions() {
  return getProductsQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getAvailabilityRulesQueryOptions() {
  return getRulesQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getAvailabilityStartTimesQueryOptions() {
  return getStartTimesQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getAvailabilitySlotsQueryOptions() {
  return getSlotsQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getAvailabilityCloseoutsQueryOptions() {
  return getCloseoutsQueryOptionsBase(client, { limit: 25, offset: 0 })
}

export function getAvailabilityPickupPointsQueryOptions() {
  return getPickupPointsQueryOptionsBase(client, { limit: 25, offset: 0 })
}
