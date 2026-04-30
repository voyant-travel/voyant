import type { ColumnDef } from "@tanstack/react-table"
import {
  type MarketCurrencyRecord,
  useMarketCurrencies,
  useMarketCurrencyMutation,
} from "@voyantjs/markets-react"
import { MarketCurrencyDialog } from "@voyantjs/markets-ui/components/market-currency-dialog"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

const PAGE_SIZE = 25

type Props = { marketId: string }

export function MarketCurrenciesTab({ marketId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MarketCurrencyRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useMarketCurrencies({
    marketId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
    enabled: Boolean(marketId),
  })
  const { remove } = useMarketCurrencyMutation()
  const columns: ColumnDef<MarketCurrencyRecord>[] = [
    {
      accessorKey: "currencyCode",
      header: "Currency",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium">{row.original.currencyCode}</span>
      ),
    },
    {
      accessorKey: "isDefault",
      header: "Default",
      cell: ({ row }) => (row.original.isDefault ? "Yes" : "-"),
    },
    {
      accessorKey: "isSettlement",
      header: "Settlement",
      cell: ({ row }) => (row.original.isSettlement ? "Yes" : "-"),
    },
    {
      accessorKey: "isReporting",
      header: "Reporting",
      cell: ({ row }) => (row.original.isReporting ? "Yes" : "-"),
    },
    {
      accessorKey: "sortOrder",
      header: "Sort",
      cell: ({ row }) => row.original.sortOrder,
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "default" : "outline"}>
          {row.original.active ? "Active" : "Inactive"}
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
              if (confirm(`Delete currency "${row.original.currencyCode}"?`)) {
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
        <p className="text-sm text-muted-foreground">
          Currencies accepted for display, settlement and reporting in this market.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Currency
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        emptyMessage={isPending ? "Loading currencies..." : "No currencies yet."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <MarketCurrencyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        marketId={marketId}
        currency={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
