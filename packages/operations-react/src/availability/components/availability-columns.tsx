"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge, Button } from "@voyant-travel/ui/components"
import { DataTableColumnHeader } from "@voyant-travel/ui/components/data-table-column-header"
import { Tooltip, TooltipContent, TooltipTrigger } from "@voyant-travel/ui/components/tooltip"
import { cn } from "@voyant-travel/ui/lib/utils"
import { AlertTriangle, ExternalLink, Pencil } from "lucide-react"
import { useAvailabilityUiMessagesOrDefault } from "../i18n/index.js"
import {
  type AvailabilityCloseoutRow,
  type AvailabilityPickupPointRow,
  type AvailabilityRuleRow,
  type AvailabilitySlotRow,
  type AvailabilityStartTimeRow,
  type ProductOption,
  productNameById,
  slotLocalEnd,
  slotLocalStart,
  slotStatusTone,
} from "../index.js"
import { slotStatusToneClass } from "./slot-status-tone.js"

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
  editLabel: string
  productLabel: string
  optionLabel: string
  optionMissingLabel: string
  optionMissingTooltip: string
  productLevelLabel: string
  reasonLabel: string
  recurrenceLabel: string
  remainingPaxLabel: string
  totalPaxLabel: string
  endsAtLabel: string
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

function formatSlotLocalDateTime(value: { date: string; time: string }) {
  return `${value.date} ${value.time}`
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

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
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
      <Pencil className="mr-2 h-4 w-4" />
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

/**
 * Lookup data for the option column. `optionNameById` resolves a slot's
 * `optionId` to a readable name; `productsWithOptions` is the set of product ids
 * that have at least one active option, used to warn only when a missing option
 * actually makes the departure unpriceable (#2062).
 */
export interface SlotOptionInfo {
  optionNameById: Map<string, string>
  productsWithOptions: Set<string>
}

export const availabilitySlotColumns = (
  products: ProductOption[],
  onView: (slotId: string) => void,
  messages: AvailabilityColumnsMessages,
  onEdit?: (slot: AvailabilitySlotRow) => void,
  optionInfo?: SlotOptionInfo,
): ColumnDef<AvailabilitySlotRow>[] => [
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.productLabel} />,
    cell: ({ row }) => productNameById(products, row.original.productId, row.original.productName),
  },
  {
    id: "option",
    header: () => messages.optionLabel,
    cell: ({ row }) => {
      const { optionId, productId } = row.original
      if (optionId) {
        return optionInfo?.optionNameById.get(optionId) ?? messages.details.noValue
      }
      // No option set: only flag it when the product actually has options, so a
      // legitimately option-less product isn't warned.
      if (optionInfo?.productsWithOptions.has(productId)) {
        return (
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"
              >
                <AlertTriangle className="h-3 w-3" />
                {messages.optionMissingLabel}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{messages.optionMissingTooltip}</TooltipContent>
          </Tooltip>
        )
      }
      return messages.details.noValue
    },
  },
  {
    accessorKey: "startsAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.startsAtLabel} />
    ),
    cell: ({ row }) => formatSlotLocalDateTime(slotLocalStart(row.original)),
  },
  {
    accessorKey: "endsAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.endsAtLabel} />,
    cell: ({ row }) =>
      row.original.endsAt
        ? formatSlotLocalDateTime(slotLocalEnd(row.original) ?? slotLocalStart(row.original))
        : messages.details.noValue,
  },
  {
    accessorKey: "initialPax",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.totalPaxLabel} />
    ),
    cell: ({ row }) => row.original.initialPax ?? messages.details.noValue,
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
      <Badge
        variant="outline"
        className={cn("capitalize", slotStatusToneClass[slotStatusTone[row.original.status]])}
      >
        {getSlotStatusLabel(row.original.status, messages)}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{messages.viewLabel}</span>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        {onEdit ? (
          <EditButton label={messages.editLabel} onClick={() => onEdit(row.original)} />
        ) : null}
        <ViewButton label={messages.openLabel} onClick={() => onView(row.original.id)} />
      </div>
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
