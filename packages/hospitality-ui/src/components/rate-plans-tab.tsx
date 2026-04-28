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

import { PaginationFooter } from "./pagination-footer"
import { RatePlanDialog } from "./rate-plan-dialog"

export interface RatePlansTabProps {
  propertyId: string
}
const PAGE_SIZE = 25

export function RatePlansTab({ propertyId }: RatePlansTabProps) {
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
        <p className="text-sm text-muted-foreground">
          Commercial rate plans with pricing, guarantee, and cancellation defaults.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Rate Plan
        </Button>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No rate plans yet.</p>
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">Code</th>
                <th className="p-3 text-left font-medium">Name</th>
                <th className="p-3 text-left font-medium">Catalog</th>
                <th className="p-3 text-left font-medium">Cancellation</th>
                <th className="p-3 text-left font-medium">Meal Plan</th>
                <th className="p-3 text-left font-medium">Currency</th>
                <th className="p-3 text-left font-medium">Charge</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="p-3 font-mono text-xs">{row.code}</td>
                  <td className="p-3 font-medium">{row.name}</td>
                  <td className="p-3 text-muted-foreground">
                    {row.priceCatalogId ? (catalogMap.get(row.priceCatalogId) ?? "—") : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {row.cancellationPolicyId
                      ? (cancelMap.get(row.cancellationPolicyId) ?? "—")
                      : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {row.mealPlanId ? (mealMap.get(row.mealPlanId) ?? "—") : "—"}
                  </td>
                  <td className="p-3 font-mono text-xs">{row.currencyCode}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="capitalize">
                      {row.chargeFrequency.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={row.active ? "default" : "outline"}>
                      {row.active ? "Active" : "Inactive"}
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
                          if (confirm(`Delete rate plan "${row.name}"?`)) {
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
