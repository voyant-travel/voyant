"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { type MarketRecord, useMarketMutation, useMarkets } from "@voyantjs/markets-react"
import { Globe, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { useMarketsUiMessagesOrDefault } from "../../../markets-ui/src/index"

import { useRegistryMarketsMessagesOrDefault } from "./i18n"
import { MarketCurrenciesTab } from "./market-currencies-tab"
import { MarketDialog } from "./market-dialog"
import { MarketLocalesTab } from "./market-locales-tab"

const PAGE_SIZE = 25

export function MarketsPage() {
  const sharedMessages = useMarketsUiMessagesOrDefault()
  const pageMessages = useRegistryMarketsMessagesOrDefault().page
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MarketRecord | undefined>()
  const [selectedMarketId, setSelectedMarketId] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useMarkets({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useMarketMutation()

  const rows = data?.data ?? []
  const selectedMarket = rows.find((market) => market.id === selectedMarketId)

  const columns = useMemo<ColumnDef<MarketRecord>[]>(
    () => [
      {
        accessorKey: "code",
        header: pageMessages.columns.code,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
      },
      {
        accessorKey: "name",
        header: pageMessages.columns.name,
        cell: ({ row }) => row.original.name,
      },
      {
        accessorKey: "countryCode",
        header: pageMessages.columns.country,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.countryCode ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "defaultLanguageTag",
        header: pageMessages.columns.language,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.defaultLanguageTag}
          </span>
        ),
      },
      {
        accessorKey: "defaultCurrency",
        header: pageMessages.columns.currency,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.defaultCurrency}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: pageMessages.columns.status,
        cell: ({ row }) => (
          <Badge variant={row.original.status === "active" ? "default" : "outline"}>
            {sharedMessages.common.marketStatusLabels[row.original.status]}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => <div className="w-32" />,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setSelectedMarketId(row.original.id)}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {pageMessages.columns.configure}
            </button>
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
                if (confirm(pageMessages.actions.deleteConfirm)) {
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
    [pageMessages, refetch, remove, sharedMessages.common.marketStatusLabels],
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Globe className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{pageMessages.description}</p>
          <Button
            size="sm"
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {pageMessages.addMarket}
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          emptyMessage={isPending ? pageMessages.empty.loading : pageMessages.empty.noMarkets}
          pagination={{
            pageIndex,
            pageSize: PAGE_SIZE,
            total: data?.total ?? 0,
            onPageIndexChange: setPageIndex,
          }}
        />
      </div>

      {selectedMarket ? (
        <div className="flex flex-col gap-3 rounded-md border bg-background p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                {pageMessages.selected.title}
              </p>
              <p className="font-medium">
                {selectedMarket.name} ({selectedMarket.code})
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedMarketId("")}>
              {pageMessages.selected.close}
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            <MarketLocalesTab marketId={selectedMarket.id} />
            <MarketCurrenciesTab marketId={selectedMarket.id} />
          </div>
        </div>
      ) : null}

      <MarketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        market={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
