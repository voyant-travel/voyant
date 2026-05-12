"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type AvailabilityCloseoutRow,
  type AvailabilityPickupPointRow,
  type AvailabilityRuleRow,
  type AvailabilitySlotRow,
  type AvailabilityStartTimeRow,
  formatDateTime,
  type ProductOption,
  productNameById,
  slotStatusVariant,
} from "@voyantjs/availability-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { ExternalLink } from "lucide-react"
import { useAvailabilityUiMessagesOrDefault } from "../i18n/index.js"

export interface AvailabilityColumnsMessages {
  activeLabel: string
  dateLabel: string
  details: {
    noValue: string
  }
  durationLabel: string
  labelLabel: string
  locationLabel: string
  maxPaxLabel: string
  nameLabel: string
  openLabel: string
  productLabel: string
  productLevelLabel: string
  reasonLabel: string
  recurrenceLabel: string
  remainingPaxLabel: string
  slotLabel: string
  startLabel: string
  startsAtLabel: string
  statusActive: string
  statusCancelled: string
  statusClosed: string
  statusInactive: string
  statusLabel: string
  statusOpen: string
  statusSoldOut: string
  timezoneLabel: string
  viewLabel: string
}

export function getSlotStatusLabel(
  status: AvailabilitySlotRow["status"],
  messages: AvailabilityColumnsMessages,
) {
  switch (status) {
    case "open":
      return messages.statusOpen
    case "closed":
      return messages.statusClosed
    case "sold_out":
      return messages.statusSoldOut
    case "cancelled":
      return messages.statusCancelled
  }
}

function ViewButton({ label, onClick }: { label: string; onClick: () => void }) {
  useAvailabilityUiMessagesOrDefault()
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      {label}
    </Button>
  )
}

export const availabilityRuleColumns = (
  products: ProductOption[],
  onView: (ruleId: string) => void,
  messages: AvailabilityColumnsMessages,
): ColumnDef<AvailabilityRuleRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.productLabel} />,
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "timezone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.timezoneLabel} />
    ),
  },
  {
    accessorKey: "recurrenceRule",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.recurrenceLabel} />
    ),
    cell: ({ row }) => (
      <span className="max-w-[380px] truncate font-mono text-xs">
        {row.original.recurrenceRule}
      </span>
    ),
  },
  {
    accessorKey: "maxCapacity",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.maxPaxLabel} />,
  },
  {
    accessorKey: "active",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.activeLabel} />,
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active ? messages.statusActive : messages.statusInactive}
      </Badge>
    ),
  },
  {
    id: "view",
    header: messages.viewLabel,
    cell: ({ row }) => (
      <ViewButton label={messages.openLabel} onClick={() => onView(row.original.id)} />
    ),
  },
]

export const availabilityStartTimeColumns = (
  products: ProductOption[],
  onView: (startTimeId: string) => void,
  messages: AvailabilityColumnsMessages,
): ColumnDef<AvailabilityStartTimeRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.productLabel} />,
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "label",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.labelLabel} />,
    cell: ({ row }) => row.original.label ?? messages.details.noValue,
  },
  {
    accessorKey: "startTimeLocal",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.startLabel} />,
  },
  {
    accessorKey: "durationMinutes",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.durationLabel} />
    ),
    cell: ({ row }) =>
      row.original.durationMinutes == null
        ? messages.details.noValue
        : `${row.original.durationMinutes} min`,
  },
  {
    accessorKey: "active",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.statusLabel} />,
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active ? messages.statusActive : messages.statusInactive}
      </Badge>
    ),
  },
  {
    id: "view",
    header: messages.viewLabel,
    cell: ({ row }) => (
      <ViewButton label={messages.openLabel} onClick={() => onView(row.original.id)} />
    ),
  },
]

export const availabilitySlotColumns = (
  products: ProductOption[],
  onView: (slotId: string) => void,
  messages: AvailabilityColumnsMessages,
): ColumnDef<AvailabilitySlotRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.productLabel} />,
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "dateLocal",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.dateLabel} />,
  },
  {
    accessorKey: "startsAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.startsAtLabel} />
    ),
    cell: ({ row }) => formatDateTime(row.original.startsAt),
  },
  {
    accessorKey: "remainingPax",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.remainingPaxLabel} />
    ),
    cell: ({ row }) => row.original.remainingPax ?? messages.details.noValue,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.statusLabel} />,
    cell: ({ row }) => (
      <Badge variant={slotStatusVariant[row.original.status]} className="capitalize">
        {getSlotStatusLabel(row.original.status, messages)}
      </Badge>
    ),
  },
  {
    id: "view",
    header: messages.viewLabel,
    cell: ({ row }) => (
      <ViewButton label={messages.openLabel} onClick={() => onView(row.original.id)} />
    ),
  },
]

export const availabilityCloseoutColumns = (
  products: ProductOption[],
  messages: AvailabilityColumnsMessages,
): ColumnDef<AvailabilityCloseoutRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.productLabel} />,
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "dateLocal",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.dateLabel} />,
  },
  {
    accessorKey: "slotId",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.slotLabel} />,
    cell: ({ row }) => row.original.slotId ?? messages.productLevelLabel,
  },
  {
    accessorKey: "reason",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.reasonLabel} />,
    cell: ({ row }) => row.original.reason ?? messages.details.noValue,
  },
]

export const availabilityPickupPointColumns = (
  products: ProductOption[],
  messages: AvailabilityColumnsMessages,
): ColumnDef<AvailabilityPickupPointRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.productLabel} />,
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.nameLabel} />,
  },
  {
    accessorKey: "locationText",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.locationLabel} />
    ),
    cell: ({ row }) => row.original.locationText ?? messages.details.noValue,
  },
  {
    accessorKey: "active",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.statusLabel} />,
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active ? messages.statusActive : messages.statusInactive}
      </Badge>
    ),
  },
]
