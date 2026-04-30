"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type OptionStartTimeRuleRecord,
  useOptionStartTimeRuleMutation,
  useOptionStartTimeRules,
} from "@voyantjs/pricing-react"
import { OptionStartTimeRuleDialog } from "@voyantjs/pricing-ui/components/option-start-time-rule-dialog"
import { OptionPriceRuleLabel } from "@voyantjs/pricing-ui/components/pricing-shared-labels"
import { Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

const PAGE_SIZE = 25

export function OptionStartTimeRulesPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OptionStartTimeRuleRecord | undefined>()
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending, refetch } = useOptionStartTimeRules({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useOptionStartTimeRuleMutation()

  const columns = React.useMemo<ColumnDef<OptionStartTimeRuleRecord>[]>(
    () => [
      {
        accessorKey: "optionPriceRuleId",
        header: "Option price rule",
        cell: ({ row }) => <OptionPriceRuleLabel id={row.original.optionPriceRuleId} />,
      },
      {
        accessorKey: "startTimeId",
        header: "Start time",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.startTimeId}</span>,
      },
      {
        accessorKey: "ruleMode",
        header: "Mode",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.ruleMode.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "adjustmentType",
        header: "Adj. type",
        cell: ({ row }) => (
          <span className="text-xs capitalize text-muted-foreground">
            {row.original.adjustmentType ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "sellAdjustmentCents",
        header: "Sell adj.",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.sellAdjustmentCents != null
              ? (row.original.sellAdjustmentCents / 100).toFixed(2)
              : "-"}
          </span>
        ),
      },
      {
        accessorKey: "costAdjustmentCents",
        header: "Cost adj.",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.costAdjustmentCents != null
              ? (row.original.costAdjustmentCents / 100).toFixed(2)
              : "-"}
          </span>
        ),
      },
      {
        accessorKey: "adjustmentBasisPoints",
        header: "%",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.adjustmentBasisPoints != null
              ? `${(row.original.adjustmentBasisPoints / 100).toFixed(2)}%`
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
          <h2 className="text-lg font-semibold tracking-tight">Option Start Time Rules</h2>
          <p className="text-sm text-muted-foreground">
            Price adjustments or overrides based on start time for an option price rule.
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
          isPending ? "Loading option start time rules..." : "No option start time rules found."
        }
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <OptionStartTimeRuleDialog
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
