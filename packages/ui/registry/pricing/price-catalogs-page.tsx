"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type PriceCatalogRecord,
  usePriceCatalogMutation,
  usePriceCatalogs,
} from "@voyantjs/pricing-react"
import { usePricingUiMessagesOrDefault } from "@voyantjs/pricing-ui"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import * as React from "react"

import { Badge, Button, Input } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

import { useRegistryPricingMessagesOrDefault } from "./i18n"
import { PriceCatalogDialog } from "./price-catalog-dialog"

const PAGE_SIZE = 25

export function PriceCatalogsPage() {
  const sharedMessages = usePricingUiMessagesOrDefault()
  const registryMessages = useRegistryPricingMessagesOrDefault()
  const pageMessages = registryMessages.priceCatalogsPage
  const catalogLabels = registryMessages.priceCatalogDialog.catalogTypeLabels
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PriceCatalogRecord | undefined>()
  const [search, setSearch] = React.useState("")
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending, refetch } = usePriceCatalogs({
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = usePriceCatalogMutation()

  const columns = React.useMemo<ColumnDef<PriceCatalogRecord>[]>(
    () => [
      {
        accessorKey: "code",
        header: pageMessages.columns.code,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
      },
      {
        accessorKey: "name",
        header: pageMessages.columns.name,
      },
      {
        accessorKey: "catalogType",
        header: pageMessages.columns.type,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {catalogLabels[row.original.catalogType]}
          </Badge>
        ),
      },
      {
        accessorKey: "currencyCode",
        header: pageMessages.columns.currency,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.currencyCode}</span>,
      },
      {
        accessorKey: "isDefault",
        header: pageMessages.columns.default,
        cell: ({ row }) =>
          row.original.isDefault ? (
            <Badge variant="secondary">{pageMessages.labels.default}</Badge>
          ) : (
            <span>—</span>
          ),
      },
      {
        accessorKey: "active",
        header: pageMessages.columns.status,
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "default" : "outline"}>
            {row.original.active ? sharedMessages.common.active : sharedMessages.common.inactive}
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
    [
      catalogLabels,
      pageMessages,
      refetch,
      remove,
      sharedMessages.common.active,
      sharedMessages.common.inactive,
    ],
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{pageMessages.title}</h2>
        <p className="text-sm text-muted-foreground">{pageMessages.description}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={pageMessages.searchPlaceholder}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPageIndex(0)
            }}
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" />
          {pageMessages.add}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        emptyMessage={isPending ? pageMessages.emptyLoading : pageMessages.empty}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <PriceCatalogDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        catalog={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
