"use client"

import { useQueries } from "@tanstack/react-query"
import {
  getMealPlanQueryOptions,
  type RatePlanRecord,
  useRatePlanMutation,
  useRatePlans,
  useVoyantHospitalityContext,
} from "@voyantjs/hospitality-react"
import {
  getCancellationPolicyQueryOptions,
  getPriceCatalogQueryOptions,
  useVoyantPricingContext,
} from "@voyantjs/pricing-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { useHospitalityUiMessagesOrDefault } from "../i18n"
import type { ChargeFrequency } from "../i18n/messages"
import { PaginationFooter } from "./pagination-footer"
import { RatePlanDialog } from "./rate-plan-dialog"

export interface RatePlansTabProps {
  propertyId: string
}
const PAGE_SIZE = 25

export function RatePlansTab({ propertyId }: RatePlansTabProps) {
  const messages = useHospitalityUiMessagesOrDefault()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<RatePlanRecord | undefined>(undefined)
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending } = useRatePlans({
    propertyId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useRatePlanMutation()
  const { baseUrl: hospitalityBaseUrl, fetcher: hospitalityFetcher } = useVoyantHospitalityContext()
  const { baseUrl: pricingBaseUrl, fetcher: pricingFetcher } = useVoyantPricingContext()
  const rows = (data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const catalogIds = Array.from(new Set(rows.map((row) => row.priceCatalogId).filter(Boolean)))
  const cancelIds = Array.from(new Set(rows.map((row) => row.cancellationPolicyId).filter(Boolean)))
  const mealIds = Array.from(new Set(rows.map((row) => row.mealPlanId).filter(Boolean)))
  const catalogQueries = useQueries({
    queries: catalogIds.map((id) =>
      getPriceCatalogQueryOptions({ baseUrl: pricingBaseUrl, fetcher: pricingFetcher }, id!),
    ),
  })
  const cancelQueries = useQueries({
    queries: cancelIds.map((id) =>
      getCancellationPolicyQueryOptions({ baseUrl: pricingBaseUrl, fetcher: pricingFetcher }, id!),
    ),
  })
  const mealQueries = useQueries({
    queries: mealIds.map((id) =>
      getMealPlanQueryOptions({ baseUrl: hospitalityBaseUrl, fetcher: hospitalityFetcher }, id!),
    ),
  })
  const catalogMap = new Map(
    catalogQueries.flatMap((query) => (query.data ? [[query.data.id, query.data.name]] : [])),
  )
  const cancelMap = new Map(
    cancelQueries.flatMap((query) => (query.data ? [[query.data.id, query.data.name]] : [])),
  )
  const mealMap = new Map(
    mealQueries.flatMap((query) => (query.data ? [[query.data.id, query.data.name]] : [])),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{messages.ratePlansTab.description}</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {messages.ratePlansTab.add}
        </Button>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{messages.ratePlansTab.empty}</p>
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">{messages.ratePlansTab.columns.code}</th>
                <th className="p-3 text-left font-medium">{messages.ratePlansTab.columns.name}</th>
                <th className="p-3 text-left font-medium">
                  {messages.ratePlansTab.columns.catalog}
                </th>
                <th className="p-3 text-left font-medium">
                  {messages.ratePlansTab.columns.cancellation}
                </th>
                <th className="p-3 text-left font-medium">
                  {messages.ratePlansTab.columns.mealPlan}
                </th>
                <th className="p-3 text-left font-medium">
                  {messages.ratePlansTab.columns.currency}
                </th>
                <th className="p-3 text-left font-medium">
                  {messages.ratePlansTab.columns.charge}
                </th>
                <th className="p-3 text-left font-medium">
                  {messages.ratePlansTab.columns.status}
                </th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="p-3 font-mono text-xs">{row.code}</td>
                  <td className="p-3 font-medium">{row.name}</td>
                  <td className="p-3 text-muted-foreground">
                    {row.priceCatalogId
                      ? (catalogMap.get(row.priceCatalogId) ?? messages.common.none)
                      : messages.common.none}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {row.cancellationPolicyId
                      ? (cancelMap.get(row.cancellationPolicyId) ?? messages.common.none)
                      : messages.common.none}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {row.mealPlanId
                      ? (mealMap.get(row.mealPlanId) ?? messages.common.none)
                      : messages.common.none}
                  </td>
                  <td className="p-3 font-mono text-xs">{row.currencyCode}</td>
                  <td className="p-3">
                    <Badge variant="outline">
                      {
                        messages.common.chargeFrequencyLabels[
                          row.chargeFrequency as ChargeFrequency
                        ]
                      }
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={row.active ? "default" : "outline"}>
                      {row.active ? messages.common.active : messages.common.inactive}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(row)
                          setDialogOpen(true)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(messages.ratePlansTab.deleteConfirm.replace("{name}", row.name))
                          ) {
                            remove.mutate(row.id)
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationFooter
        pageIndex={pageIndex}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onPageIndexChange={setPageIndex}
      />

      <RatePlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        ratePlan={editing}
      />
    </div>
  )
}
