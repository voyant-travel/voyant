"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type PickupPriceRuleRecord,
  usePickupPriceRuleMutation,
  usePickupPriceRules,
} from "@voyantjs/pricing-react"
import { usePricingUiI18nOrDefault, usePricingUiMessagesOrDefault } from "@voyantjs/pricing-ui"
import { Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

import { useRegistryPricingMessagesOrDefault } from "./i18n"
import { PickupPriceRuleDialog } from "./pickup-price-rule-dialog"
import { OptionPriceRuleLabel } from "./pricing-shared-labels"

const PAGE_SIZE = 25

export function PickupPriceRulesPage() {
  const sharedI18n = usePricingUiI18nOrDefault()
  const sharedMessages = usePricingUiMessagesOrDefault()
  const registryMessages = useRegistryPricingMessagesOrDefault()
  const pageMessages = registryMessages.pickupPriceRulesPage
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
        header: pageMessages.columns.optionPriceRule,
        cell: ({ row }) => <OptionPriceRuleLabel id={row.original.optionPriceRuleId} />,
      },
      {
        accessorKey: "pickupPointId",
        header: pageMessages.columns.pickupPoint,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.pickupPointId}</span>,
      },
      {
        accessorKey: "pricingMode",
        header: pageMessages.columns.mode,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {sharedMessages.common.addonPricingModeLabels[row.original.pricingMode]}
          </Badge>
        ),
      },
      {
        accessorKey: "sellAmountCents",
        header: pageMessages.columns.sell,
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.sellAmountCents != null
              ? sharedI18n.formatNumber(row.original.sellAmountCents / 100, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "-"}
          </span>
        ),
      },
      {
        accessorKey: "costAmountCents",
        header: pageMessages.columns.cost,
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.costAmountCents != null
              ? sharedI18n.formatNumber(row.original.costAmountCents / 100, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "-"}
          </span>
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
    [pageMessages, refetch, remove, sharedI18n, sharedMessages],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{pageMessages.title}</h2>
          <p className="text-sm text-muted-foreground">{pageMessages.description}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
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
