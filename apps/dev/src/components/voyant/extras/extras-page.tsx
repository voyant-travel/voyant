"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type ProductExtraRecord,
  useProductExtraMutation,
  useProductExtras,
} from "@voyantjs/extras-react"
import { ProductCombobox } from "@voyantjs/extras-ui/components/product-combobox"
import { Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react"
import * as React from "react"
import { Badge, Button, Input, Label } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { ProductExtraDialog } from "./product-extra-dialog"

const PAGE_SIZE = 25

export function ExtrasPage() {
  const [productId, setProductId] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ProductExtraRecord | undefined>()
  const [search, setSearch] = React.useState("")
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending, refetch } = useProductExtras({
    productId: productId || undefined,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
    enabled: !!productId,
  })
  const { remove } = useProductExtraMutation()

  const rows = React.useMemo(
    () => (data?.data ?? []).slice().sort((left, right) => left.sortOrder - right.sortOrder),
    [data?.data],
  )
  const nextSort = rows.length > 0 ? Math.max(...rows.map((row) => row.sortOrder)) + 1 : 0

  const columns = React.useMemo<ColumnDef<ProductExtraRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.code ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "selectionType",
        header: "Selection",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.selectionType.replace("_", " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "pricingMode",
        header: "Pricing",
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="secondary" className="capitalize">
              {row.original.pricingMode.replace("_", " ")}
            </Badge>
            {row.original.pricedPerPerson ? <Badge variant="outline">per person</Badge> : null}
          </div>
        ),
      },
      {
        accessorKey: "quantity",
        header: "Qty",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{formatQty(row.original)}</span>
        ),
      },
      {
        accessorKey: "sortOrder",
        header: "Sort",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.sortOrder}</span>,
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
          <div className="flex items-center justify-end gap-1">
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
                if (confirm(`Delete extra "${row.original.name}"?`)) {
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
    [refetch, remove],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Extras</h1>
          <p className="text-sm text-muted-foreground">
            Configure optional add-ons travelers can choose alongside a product.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <Label>Product</Label>
          <ProductCombobox
            value={productId}
            onChange={(value) => {
              setProductId(value)
              setPageIndex(0)
            }}
            placeholder="Select a product…"
          />
          <p className="text-xs text-muted-foreground">
            Pick a product to manage optional add-ons such as transfers, upgrades, and tastings.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Search extras</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPageIndex(0)
              }}
              placeholder="Search extras…"
              className="pl-9"
              disabled={!productId}
            />
          </div>
        </div>
      </div>

      {!productId ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Select a product above to configure its extras.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Product Extras</h2>
              <p className="text-sm text-muted-foreground">
                Optional add-ons travelers can select during booking.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditing(undefined)
                setDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Extra
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            emptyMessage={isPending ? "Loading extras..." : "No extras found."}
            pagination={{
              pageIndex,
              pageSize: PAGE_SIZE,
              total: data?.total ?? 0,
              onPageIndexChange: setPageIndex,
            }}
          />
        </div>
      )}

      {productId ? (
        <ProductExtraDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productId={productId}
          extra={editing}
          nextSortOrder={nextSort}
          onSuccess={() => {
            setDialogOpen(false)
            setEditing(undefined)
            void refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function formatQty(row: ProductExtraRecord): string {
  const parts: string[] = []
  if (row.minQuantity != null) parts.push(`min ${row.minQuantity}`)
  if (row.maxQuantity != null) parts.push(`max ${row.maxQuantity}`)
  if (row.defaultQuantity != null) parts.push(`default ${row.defaultQuantity}`)
  return parts.length > 0 ? parts.join(" · ") : "-"
}
