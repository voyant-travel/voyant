"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type OptionPriceRuleRecord,
  useOptionPriceRuleMutation,
  useOptionPriceRules,
} from "@voyantjs/pricing-react"
import { OptionPriceRuleDialog } from "@voyantjs/pricing-ui/components/option-price-rule-dialog"
import {
  CancellationPolicyLabel,
  PriceCatalogLabel,
  PriceScheduleLabel,
  ProductLabel,
  ProductOptionLabel,
} from "@voyantjs/pricing-ui/components/pricing-shared-labels"
import { Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

const PAGE_SIZE = 25

export function OptionPriceRulesPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OptionPriceRuleRecord | undefined>()
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending, refetch } = useOptionPriceRules({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useOptionPriceRuleMutation()

  const columns = React.useMemo<ColumnDef<OptionPriceRuleRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "productId",
        header: "Product",
        cell: ({ row }) => <ProductLabel id={row.original.productId} />,
      },
      {
        accessorKey: "optionId",
        header: "Option",
        cell: ({ row }) => <ProductOptionLabel id={row.original.optionId} />,
      },
      {
        accessorKey: "priceCatalogId",
        header: "Catalog",
        cell: ({ row }) => <PriceCatalogLabel id={row.original.priceCatalogId} />,
      },
      {
        accessorKey: "priceScheduleId",
        header: "Schedule",
        cell: ({ row }) =>
          row.original.priceScheduleId ? (
            <PriceScheduleLabel id={row.original.priceScheduleId} />
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "cancellationPolicyId",
        header: "Policy",
        cell: ({ row }) =>
          row.original.cancellationPolicyId ? (
            <CancellationPolicyLabel id={row.original.cancellationPolicyId} />
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
        accessorKey: "baseSellAmountCents",
        header: "Base sell",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.baseSellAmountCents != null
              ? (row.original.baseSellAmountCents / 100).toFixed(2)
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
                if (confirm(`Delete rule "${row.original.name}"?`)) {
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
          <h2 className="text-lg font-semibold tracking-tight">Option Price Rules</h2>
          <p className="text-sm text-muted-foreground">
            Base price rules per product option and catalog. Downstream rules attach to these.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" />
          New rule
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        emptyMessage={isPending ? "Loading option price rules..." : "No option price rules found."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <OptionPriceRuleDialog
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
