"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { type OrderRecord, useOrderMutation, useOrders } from "@voyantjs/transactions-react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import {
  useRegistryTransactionsI18nOrDefault,
  useRegistryTransactionsMessagesOrDefault,
} from "./i18n"
import { OrderDialog } from "./order-dialog"

const PAGE_SIZE = 25

function statusVariant(status: string) {
  if (status === "confirmed" || status === "fulfilled") return "default" as const
  if (status === "cancelled" || status === "expired") return "destructive" as const
  return "outline" as const
}

export function OrdersTab() {
  const { formatCurrency, formatDate } = useRegistryTransactionsI18nOrDefault()
  const messages = useRegistryTransactionsMessagesOrDefault()
  const tabMessages = messages.ordersTab
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<OrderRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useOrders({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useOrderMutation()

  const columns = useMemo<ColumnDef<OrderRecord>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: tabMessages.columns.number,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNumber}</span>,
      },
      {
        accessorKey: "title",
        header: tabMessages.columns.title,
      },
      {
        accessorKey: "status",
        header: tabMessages.columns.status,
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)}>
            {messages.common.orderStatusLabels[row.original.status]}
          </Badge>
        ),
      },
      {
        accessorKey: "totalAmountCents",
        header: tabMessages.columns.total,
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {formatCurrency(row.original.totalAmountCents / 100, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "orderedAt",
        header: tabMessages.columns.ordered,
        cell: ({ row }) => (row.original.orderedAt ? formatDate(row.original.orderedAt) : "-"),
      },
      {
        id: "actions",
        header: () => <div className="w-20" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setEditing(row.original)
                setDialogOpen(true)
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(tabMessages.deleteConfirm)) {
                  remove.mutate(row.original.id, { onSuccess: () => void refetch() })
                }
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [formatCurrency, formatDate, messages.common.orderStatusLabels, refetch, remove, tabMessages],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tabMessages.description}</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {tabMessages.add}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        emptyMessage={isPending ? tabMessages.empty.loading : tabMessages.empty.none}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <OrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
