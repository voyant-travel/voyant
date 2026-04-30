"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type PriceScheduleRecord,
  usePriceScheduleMutation,
  usePriceSchedules,
} from "@voyantjs/pricing-react"
import { PriceScheduleDialog } from "@voyantjs/pricing-ui/components/price-schedule-dialog"
import { PriceCatalogLabel } from "@voyantjs/pricing-ui/components/pricing-shared-labels"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import * as React from "react"
import { Badge, Button, Input } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

const PAGE_SIZE = 25

export function PriceSchedulesPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PriceScheduleRecord | undefined>()
  const [search, setSearch] = React.useState("")
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending, refetch } = usePriceSchedules({
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = usePriceScheduleMutation()

  const columns = React.useMemo<ColumnDef<PriceScheduleRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "priceCatalogId",
        header: "Catalog",
        cell: ({ row }) => <PriceCatalogLabel id={row.original.priceCatalogId} />,
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
        accessorKey: "validity",
        header: "Valid",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.validFrom ?? "—"} → {row.original.validTo ?? "∞"}
          </span>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => <span className="font-mono">{row.original.priority}</span>,
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
                if (confirm(`Delete schedule "${row.original.name}"?`)) {
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
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Price Schedules</h2>
        <p className="text-sm text-muted-foreground">
          RRULE-based seasonal windows that modulate a price catalog.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search price schedules…"
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
          New schedule
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        emptyMessage={isPending ? "Loading price schedules..." : "No price schedules found."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <PriceScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schedule={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
