"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { type OfferRecord, useOfferMutation, useOffers } from "@voyantjs/transactions-react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import {
  useRegistryTransactionsI18nOrDefault,
  useRegistryTransactionsMessagesOrDefault,
} from "./i18n"
import { OfferDialog } from "./offer-dialog"

const PAGE_SIZE = 25

export function OffersTab() {
  const { formatCurrency, formatDate } = useRegistryTransactionsI18nOrDefault()
  const messages = useRegistryTransactionsMessagesOrDefault()
  const tabMessages = messages.offersTab
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<OfferRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useOffers({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useOfferMutation()

  const columns = useMemo<ColumnDef<OfferRecord>[]>(
    () => [
      {
        accessorKey: "offerNumber",
        header: tabMessages.columns.number,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.offerNumber}</span>,
      },
      {
        accessorKey: "title",
        header: tabMessages.columns.title,
      },
      {
        accessorKey: "status",
        header: tabMessages.columns.status,
        cell: ({ row }) => (
          <Badge variant={row.original.status === "accepted" ? "default" : "outline"}>
            {messages.common.offerStatusLabels[row.original.status]}
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
        accessorKey: "validUntil",
        header: tabMessages.columns.validUntil,
        cell: ({ row }) => (row.original.validUntil ? formatDate(row.original.validUntil) : "-"),
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
    [formatCurrency, formatDate, messages.common.offerStatusLabels, refetch, remove, tabMessages],
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

      <OfferDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        offer={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
