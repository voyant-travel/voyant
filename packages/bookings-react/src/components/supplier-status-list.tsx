"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { Package, Pencil, Plus } from "lucide-react"
import * as React from "react"
import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { type BookingSupplierStatusRecord, useSupplierStatuses } from "../index.js"
import { IconActionButton } from "./icon-action-button.js"
import { StatusBadge } from "./status-badge.js"
import { SupplierStatusDialog } from "./supplier-status-dialog.js"

export interface SupplierStatusListProps {
  bookingId: string
}

interface SupplierStatusRow {
  /** The first row of the group — used as the edit target. */
  head: BookingSupplierStatusRecord
  /** How many sibling rows collapsed into this one (≥ 1). */
  count: number
  totalCostCents: number
  reference: string | null
  confirmedAt: string | null
}

export function SupplierStatusList({ bookingId }: SupplierStatusListProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingSupplierStatusRecord | undefined>(undefined)
  const { data } = useSupplierStatuses(bookingId)
  const { formatCurrency, formatDate } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  const card = messages.supplierStatusList

  const statuses = data?.data ?? []
  // `bookingSupplierStatuses` gets one row per `product_day_services`
  // entry — so a 2-day itinerary that includes the same service on
  // both days lands two visually-identical rows. The operator only
  // cares about the per-service total, so collapse identical rows
  // (same service id, name, status, cost) into one with a `× N`
  // badge. The edit pencil opens the first row of the group.
  const rows = React.useMemo<SupplierStatusRow[]>(
    () =>
      groupSupplierStatuses(statuses).map((group) => {
        const head = group.statuses[0] as BookingSupplierStatusRecord
        return {
          head,
          count: group.statuses.length,
          totalCostCents: group.statuses.reduce((sum, s) => sum + (s.costAmountCents ?? 0), 0),
          reference: group.statuses.find((s) => s.supplierReference)?.supplierReference ?? null,
          confirmedAt: group.statuses.find((s) => s.confirmedAt)?.confirmedAt ?? null,
        }
      }),
    [statuses],
  )

  const columns = React.useMemo<ColumnDef<SupplierStatusRow>[]>(
    () => [
      {
        accessorKey: "serviceName",
        header: card.columns.service,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5">
            {row.original.head.serviceName}
            {row.original.count > 1 ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                × {row.original.count}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: card.columns.status,
        cell: ({ row }) => (
          <StatusBadge status={row.original.head.status}>
            {messages.common.supplierStatusLabels[row.original.head.status]}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "totalCostCents",
        header: card.columns.cost,
        cell: ({ row }) => {
          const { totalCostCents, head } = row.original
          if (totalCostCents === 0 || !head.costCurrency) {
            return <span className="text-muted-foreground">{card.values.costUnavailable}</span>
          }
          return (
            <span className="font-mono">
              {formatCurrency(totalCostCents / 100, head.costCurrency)}
            </span>
          )
        },
      },
      {
        accessorKey: "reference",
        header: card.columns.reference,
        cell: ({ row }) => (
          <span
            title={row.original.reference ?? undefined}
            className="inline-block max-w-[180px] truncate font-mono text-muted-foreground text-xs"
          >
            {row.original.reference ?? card.values.referenceUnavailable}
          </span>
        ),
      },
      {
        accessorKey: "confirmedAt",
        header: card.columns.confirmed,
        cell: ({ row }) =>
          row.original.confirmedAt
            ? formatDate(row.original.confirmedAt)
            : card.values.confirmedUnavailable,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{card.columns.actions}</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <IconActionButton
              label={card.actions.edit}
              icon={<Pencil className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation()
                setEditing(row.original.head)
                setDialogOpen(true)
              }}
            />
          </div>
        ),
      },
    ],
    [card, formatCurrency, formatDate, messages.common.supplierStatusLabels],
  )

  return (
    <div data-slot="supplier-status-list" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Package className="h-4 w-4 text-muted-foreground" />
          {card.title}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {card.addSupplier}
        </Button>
      </div>

      <DataTable columns={columns} data={rows} emptyMessage={card.empty} showPagination={false} />

      <SupplierStatusDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditing(undefined)
          }
        }}
        bookingId={bookingId}
        supplierStatus={editing}
        onSuccess={() => {
          setEditing(undefined)
        }}
      />
    </div>
  )
}

interface SupplierStatusGroup {
  key: string
  statuses: BookingSupplierStatusRecord[]
}

function groupSupplierStatuses(
  statuses: readonly BookingSupplierStatusRecord[],
): SupplierStatusGroup[] {
  const groups = new Map<string, SupplierStatusGroup>()
  for (const status of statuses) {
    // Visually-identical rows collapse together. Reference/confirmed
    // timestamps and `id` are intentionally excluded — those differ
    // between sibling rows that the operator nonetheless sees as one
    // line of business.
    const key = [
      status.supplierServiceId ?? "",
      status.serviceName,
      status.status,
      status.costCurrency ?? "",
      status.costAmountCents ?? "",
    ].join("|")
    const existing = groups.get(key)
    if (existing) {
      existing.statuses.push(status)
    } else {
      groups.set(key, { key, statuses: [status] })
    }
  }
  return Array.from(groups.values())
}
