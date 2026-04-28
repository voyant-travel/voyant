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

export function formatLocalizedSelectionLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function getSlotStatusLabel(status: AvailabilitySlotRow["status"], messages: AdminMessages) {
  switch (status) {
    case "open":
      return messages.availability.statusOpen
    case "closed":
      return messages.availability.statusClosed
    case "sold_out":
      return messages.availability.statusSoldOut
    case "cancelled":
      return messages.availability.statusCancelled
  }
}

export const ruleColumns = (
  products: ProductOption[],
  onView: (ruleId: string) => void,
  messages: AdminMessages,
): ColumnDef<AvailabilityRuleRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.productLabel} />
    ),
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "timezone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.timezoneLabel} />
    ),
  },
  {
    accessorKey: "recurrenceRule",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.recurrenceLabel} />
    ),
    cell: ({ row }) => (
      <span className="max-w-[380px] truncate font-mono text-xs">
        {row.original.recurrenceRule}
      </span>
    ),
  },
  {
    accessorKey: "maxCapacity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.maxPaxLabel} />
    ),
  },
  {
    accessorKey: "active",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.activeLabel} />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active
          ? messages.availability.statusActive
          : messages.availability.statusInactive}
      </Badge>
    ),
  },
  {
    id: "view",
    header: messages.availability.viewLabel,
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
        {messages.availability.openLabel}
      </Button>
    ),
  },
]

export const startTimeColumns = (
  products: ProductOption[],
  onView: (startTimeId: string) => void,
  messages: AdminMessages,
): ColumnDef<AvailabilityStartTimeRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.productLabel} />
    ),
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "label",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.labelLabel} />
    ),
    cell: ({ row }) => row.original.label ?? messages.availability.details.noValue,
  },
  {
    accessorKey: "startTimeLocal",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.startLabel} />
    ),
  },
  {
    accessorKey: "durationMinutes",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.durationLabel} />
    ),
    cell: ({ row }) =>
      row.original.durationMinutes == null
        ? messages.availability.details.noValue
        : `${row.original.durationMinutes} min`,
  },
  {
    accessorKey: "active",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.statusLabel} />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active
          ? messages.availability.statusActive
          : messages.availability.statusInactive}
      </Badge>
    ),
  },
  {
    id: "view",
    header: messages.availability.viewLabel,
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
        {messages.availability.openLabel}
      </Button>
    ),
  },
]

export const slotColumns = (
  products: ProductOption[],
  onView: (slotId: string) => void,
  messages: AdminMessages,
): ColumnDef<AvailabilitySlotRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.productLabel} />
    ),
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "dateLocal",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.dateLabel} />
    ),
  },
  {
    accessorKey: "startsAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.startsAtLabel} />
    ),
    cell: ({ row }) => formatDateTime(row.original.startsAt),
  },
  {
    accessorKey: "remainingPax",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.remainingPaxLabel} />
    ),
    cell: ({ row }) => row.original.remainingPax ?? messages.availability.details.noValue,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.statusLabel} />
    ),
    cell: ({ row }) => (
      <Badge variant={slotStatusVariant[row.original.status]} className="capitalize">
        {getSlotStatusLabel(row.original.status, messages)}
      </Badge>
    ),
  },
  {
    id: "view",
    header: messages.availability.viewLabel,
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
        {messages.availability.openLabel}
      </Button>
    ),
  },
]

export const closeoutColumns = (
  products: ProductOption[],
  messages: AdminMessages,
): ColumnDef<AvailabilityCloseoutRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.productLabel} />
    ),
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "dateLocal",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.dateLabel} />
    ),
  },
  {
    accessorKey: "slotId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.slotLabel} />
    ),
    cell: ({ row }) => row.original.slotId ?? messages.availability.productLevelLabel,
  },
  {
    accessorKey: "reason",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.reasonLabel} />
    ),
    cell: ({ row }) => row.original.reason ?? messages.availability.details.noValue,
  },
]

export const pickupPointColumns = (
  products: ProductOption[],
  messages: AdminMessages,
): ColumnDef<AvailabilityPickupPointRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.productLabel} />
    ),
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.nameLabel} />
    ),
  },
  {
    accessorKey: "locationText",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.locationLabel} />
    ),
    cell: ({ row }) => row.original.locationText ?? messages.availability.details.noValue,
  },
  {
    accessorKey: "active",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.availability.statusLabel} />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active
          ? messages.availability.statusActive
          : messages.availability.statusInactive}
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
