"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type MarketLocaleRecord,
  useMarketLocaleMutation,
  useMarketLocales,
} from "@voyantjs/markets-react"
import { Pencil, Plus, Star, Trash2 } from "lucide-react"
import { useState } from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { useMarketsUiMessagesOrDefault } from "../../../markets-ui/src/index"

import { useRegistryMarketsMessagesOrDefault } from "./i18n"
import { MarketLocaleDialog } from "./market-locale-dialog"

const PAGE_SIZE = 25

export interface MarketLocalesTabProps {
  marketId: string
}

export function MarketLocalesTab({ marketId }: MarketLocalesTabProps) {
  const sharedMessages = useMarketsUiMessagesOrDefault()
  const tabMessages = useRegistryMarketsMessagesOrDefault().localesTab
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MarketLocaleRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useMarketLocales({
    marketId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
    enabled: Boolean(marketId),
  })
  const { remove } = useMarketLocaleMutation()

  const columns: ColumnDef<MarketLocaleRecord>[] = [
    {
      accessorKey: "languageTag",
      header: tabMessages.columns.language,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.languageTag}</span>,
    },
    {
      accessorKey: "isDefault",
      header: tabMessages.columns.default,
      cell: ({ row }) =>
        row.original.isDefault ? (
          <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
        ) : null,
    },
    {
      accessorKey: "sortOrder",
      header: tabMessages.columns.sort,
      cell: ({ row }) => row.original.sortOrder,
    },
    {
      accessorKey: "active",
      header: tabMessages.columns.status,
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "default" : "outline"}>
          {row.original.active ? sharedMessages.common.active : sharedMessages.common.cancel}
        </Badge>
      ),
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
              if (confirm(tabMessages.actions.deleteConfirm)) {
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
  ]

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
        emptyMessage={isPending ? tabMessages.empty.loading : tabMessages.empty.noLocales}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <MarketLocaleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        marketId={marketId}
        locale={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
