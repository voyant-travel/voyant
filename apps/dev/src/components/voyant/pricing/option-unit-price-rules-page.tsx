"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type OptionUnitPriceRuleRecord,
  useOptionUnitPriceRuleMutation,
  useOptionUnitPriceRules,
} from "@voyantjs/pricing-react"
import { OptionUnitPriceRuleDialog } from "@voyantjs/pricing-ui/components/option-unit-price-rule-dialog"
import {
  OptionPriceRuleLabel,
  PricingCategoryLabel,
} from "@voyantjs/pricing-ui/components/pricing-shared-labels"
import { Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

const PAGE_SIZE = 25

export function OptionUnitPriceRulesPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OptionUnitPriceRuleRecord | undefined>()
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending, refetch } = useOptionUnitPriceRules({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useOptionUnitPriceRuleMutation()

  const columns = React.useMemo<ColumnDef<OptionUnitPriceRuleRecord>[]>(
    () => [
      {
        accessorKey: "optionPriceRuleId",
        header: "Option price rule",
        cell: ({ row }) => <OptionPriceRuleLabel id={row.original.optionPriceRuleId} />,
      },
      {
        accessorKey: "unitId",
        header: "Unit",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.unitId}</span>,
      },
      {
        accessorKey: "pricingCategoryId",
        header: "Pricing category",
        cell: ({ row }) =>
          row.original.pricingCategoryId ? (
            <PricingCategoryLabel id={row.original.pricingCategoryId} />
          ) : (
            "—"
          ),
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
        accessorKey: "quantity",
        header: "Qty",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.minQuantity ?? 0}-{row.original.maxQuantity ?? "∞"}
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
          <h2 className="text-lg font-semibold tracking-tight">Option Unit Price Rules</h2>
          <p className="text-sm text-muted-foreground">
            Per-unit pricing overrides attached to an option price rule.
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
        emptyMessage={
          isPending ? "Loading option unit price rules..." : "No option unit price rules found."
        }
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <OptionUnitPriceRuleDialog
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
