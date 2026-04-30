"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type OptionUnitTierRecord,
  useOptionUnitTierMutation,
  useOptionUnitTiers,
} from "@voyantjs/pricing-react"
import { OptionUnitTierDialog } from "@voyantjs/pricing-ui/components/option-unit-tier-dialog"
import { Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

const PAGE_SIZE = 25

export function OptionUnitTiersPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OptionUnitTierRecord | undefined>()
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending, refetch } = useOptionUnitTiers({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useOptionUnitTierMutation()

  const columns = React.useMemo<ColumnDef<OptionUnitTierRecord>[]>(
    () => [
      {
        accessorKey: "optionUnitPriceRuleId",
        header: "Unit price rule",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.optionUnitPriceRuleId}</span>
        ),
      },
      {
        accessorKey: "quantity",
        header: "Qty range",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.minQuantity}-{row.original.maxQuantity ?? "∞"}
          </span>
        ),
      },
      {
        accessorKey: "sellAmountCents",
        header: "Sell",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.sellAmountCents != null
              ? (row.original.sellAmountCents / 100).toFixed(2)
              : "-"}
          </span>
        ),
      },
      {
        accessorKey: "costAmountCents",
        header: "Cost",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.costAmountCents != null
              ? (row.original.costAmountCents / 100).toFixed(2)
              : "-"}
          </span>
        ),
      },
      {
        accessorKey: "sortOrder",
        header: "Order",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.sortOrder}</span>
        ),
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
                if (confirm("Delete tier?")) {
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Option Unit Tiers</h2>
          <p className="text-sm text-muted-foreground">
            Quantity-based tiered pricing for option unit price rules.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Tier
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        emptyMessage={isPending ? "Loading option unit tiers..." : "No option unit tiers found."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <OptionUnitTierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tier={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
