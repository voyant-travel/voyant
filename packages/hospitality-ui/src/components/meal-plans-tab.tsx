"use client"

import { type MealPlanRecord, useMealPlanMutation, useMealPlans } from "@voyantjs/hospitality-react"
import { Badge } from "@voyantjs/voyant-ui/components/badge"
import { Button } from "@voyantjs/voyant-ui/components/button"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { MealPlanDialog } from "./meal-plan-dialog"
import { PaginationFooter } from "./pagination-footer"

export interface MealPlansTabProps {
  propertyId: string
}
const PAGE_SIZE = 25

export function MealPlansTab({ propertyId }: MealPlansTabProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MealPlanRecord | undefined>(undefined)
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending } = useMealPlans({
    propertyId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useMealPlanMutation()

  const rows = (data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Meal inclusions like BB, HB, FB, all-inclusive, and room-only.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Meal Plan
        </Button>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No meal plans yet.</p>
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">Code</th>
                <th className="p-3 text-left font-medium">Name</th>
                <th className="p-3 text-left font-medium">Includes</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const includes: string[] = []
                if (row.includesBreakfast) includes.push("Breakfast")
                if (row.includesLunch) includes.push("Lunch")
                if (row.includesDinner) includes.push("Dinner")
                if (row.includesDrinks) includes.push("Drinks")

                return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="p-3 font-mono text-xs">{row.code}</td>
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {includes.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          includes.map((label) => (
                            <Badge key={label} variant="secondary">
                              {label}
                            </Badge>
                          ))
                        )}
                      </div>
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
                            if (confirm(`Delete meal plan "${row.name}"?`)) {
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
                )
              })}
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

      <MealPlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        mealPlan={editing}
      />
    </div>
  )
}
