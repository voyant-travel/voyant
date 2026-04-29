"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type ProductExtraRecord,
  useProductExtraMutation,
  useProductExtras,
} from "@voyantjs/extras-react"
import { Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react"
import * as React from "react"

import { Badge, Button, Input, Label } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

import { useRegistryExtrasMessagesOrDefault } from "./i18n"
import { ProductCombobox } from "./product-combobox"
import { ProductExtraDialog } from "./product-extra-dialog"

const PAGE_SIZE = 25

export function ExtrasPage() {
  const messages = useRegistryExtrasMessagesOrDefault()
  const pageMessages = messages.extrasPage
  const commonMessages = messages.common
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

  React.useEffect(() => {
    setPageIndex(0)
  }, [])

  const rows = React.useMemo(
    () => (data?.data ?? []).slice().sort((left, right) => left.sortOrder - right.sortOrder),
    [data?.data],
  )
  const nextSort = rows.length > 0 ? Math.max(...rows.map((row) => row.sortOrder)) + 1 : 0

  const columns = React.useMemo<ColumnDef<ProductExtraRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: pageMessages.columns.name,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "code",
        header: pageMessages.columns.code,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.code ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "selectionType",
        header: pageMessages.columns.selection,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {commonMessages.selectionTypeLabels[row.original.selectionType]}
          </Badge>
        ),
      },
      {
        accessorKey: "pricingMode",
        header: pageMessages.columns.pricing,
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="secondary" className="capitalize">
              {commonMessages.pricingModeLabels[row.original.pricingMode]}
            </Badge>
            {row.original.pricedPerPerson ? (
              <Badge variant="outline">{pageMessages.labels.perPerson}</Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "quantity",
        header: pageMessages.columns.quantity,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {formatQty(row.original, pageMessages.labels)}
          </span>
        ),
      },
      {
        accessorKey: "sortOrder",
        header: pageMessages.columns.sort,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.sortOrder}</span>,
      },
      {
        accessorKey: "active",
        header: pageMessages.columns.status,
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "default" : "outline"}>
            {row.original.active ? commonMessages.active : commonMessages.inactive}
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
                if (confirm(pageMessages.labels.deleteConfirm)) {
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
    [commonMessages, pageMessages, refetch, remove],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
          <p className="text-sm text-muted-foreground">{pageMessages.description}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <Label>{pageMessages.fields.product}</Label>
          <ProductCombobox
            value={productId}
            onChange={setProductId}
            placeholder={pageMessages.placeholders.product}
          />
          <p className="text-xs text-muted-foreground">{pageMessages.help.product}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{pageMessages.fields.search}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={pageMessages.placeholders.search}
              className="pl-9"
              disabled={!productId}
            />
          </div>
        </div>
      </div>

      {!productId ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">{pageMessages.empty.selectProduct}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{pageMessages.section.title}</h2>
              <p className="text-sm text-muted-foreground">{pageMessages.section.description}</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditing(undefined)
                setDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {pageMessages.section.add}
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            emptyMessage={isPending ? pageMessages.empty.loading : pageMessages.empty.noExtras}
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
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) setEditing(undefined)
          }}
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

function formatQty(
  extra: ProductExtraRecord,
  labels: {
    defaultQuantity: string
    infinity: string
  },
) {
  const min = extra.minQuantity ?? 0
  const max = extra.maxQuantity ?? labels.infinity
  const def = extra.defaultQuantity ?? "—"
  return `${min}-${max} (${labels.defaultQuantity} ${def})`
}
