"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type PickupPriceRuleRecord,
  usePickupPriceRuleMutation,
  usePickupPriceRules,
} from "@voyantjs/pricing-react"
import { PickupPriceRuleDialog } from "@voyantjs/pricing-ui/components/pickup-price-rule-dialog"
import { OptionPriceRuleLabel } from "@voyantjs/pricing-ui/components/pricing-shared-labels"
import { Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

const PAGE_SIZE = 25

export function PickupPriceRulesPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PickupPriceRuleRecord | undefined>()
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending, refetch } = usePickupPriceRules({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = usePickupPriceRuleMutation()

  const columns = React.useMemo<ColumnDef<PickupPriceRuleRecord>[]>(
    () => [
      {
        accessorKey: "optionPriceRuleId",
        header: "Option price rule",
        cell: ({ row }) => <OptionPriceRuleLabel id={row.original.optionPriceRuleId} />,
      },
      {
        accessorKey: "pickupPointId",
        header: "Pickup point",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.pickupPointId}</span>,
      },
      {
        accessorKey: "pricingMode",
        header: "Mode",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.pricingMode.replace(/_/g, " ")}
          </Badge>
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
                if (confirm("Delete rule?")) {
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
          <h2 className="text-lg font-semibold tracking-tight">Pickup Price Rules</h2>
          <p className="text-sm text-muted-foreground">
            Per-pickup-point pricing for option price rules.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Rule
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        emptyMessage={isPending ? "Loading pickup price rules..." : "No pickup price rules found."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <PickupPriceRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
