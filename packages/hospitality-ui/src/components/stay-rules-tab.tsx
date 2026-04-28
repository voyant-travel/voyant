"use client"

import { useQueries } from "@tanstack/react-query"
import {
  getRatePlanQueryOptions,
  getRoomTypeQueryOptions,
  type StayRuleRecord,
  useStayRuleMutation,
  useStayRules,
  useVoyantHospitalityContext,
} from "@voyantjs/hospitality-react"
import { Badge } from "@voyantjs/voyant-ui/components/badge"
import { Button } from "@voyantjs/voyant-ui/components/button"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { PaginationFooter } from "./pagination-footer"
import { StayRuleDialog } from "./stay-rule-dialog"

export interface StayRulesTabProps {
  propertyId: string
}
const PAGE_SIZE = 25

export function StayRulesTab({ propertyId }: StayRulesTabProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<StayRuleRecord | undefined>(undefined)
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending } = useStayRules({
    propertyId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useStayRuleMutation()
  const { baseUrl, fetcher } = useVoyantHospitalityContext()
  const rows = data?.data ?? []
  const roomTypeIds = Array.from(new Set(rows.map((row) => row.roomTypeId).filter(Boolean)))
  const ratePlanIds = Array.from(new Set(rows.map((row) => row.ratePlanId).filter(Boolean)))
  const roomTypeQueries = useQueries({
    queries: roomTypeIds.map((id) => getRoomTypeQueryOptions({ baseUrl, fetcher }, id!)),
  })
  const ratePlanQueries = useQueries({
    queries: ratePlanIds.map((id) => getRatePlanQueryOptions({ baseUrl, fetcher }, id!)),
  })
  const roomTypeById = new Map(
    roomTypeQueries.flatMap((query) => (query.data ? [[query.data.id, query.data]] : [])),
  )
  const ratePlanById = new Map(
    ratePlanQueries.flatMap((query) => (query.data ? [[query.data.id, query.data]] : [])),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Min/max nights, advance booking, and weekday restrictions.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Stay Rule
        </Button>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No stay rules yet.</p>
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">Rate plan</th>
                <th className="p-3 text-left font-medium">Room type</th>
                <th className="p-3 text-left font-medium">Valid</th>
                <th className="p-3 text-left font-medium">Nights</th>
                <th className="p-3 text-left font-medium">Flags</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="p-3 text-muted-foreground">
                    {row.ratePlanId
                      ? (ratePlanById.get(row.ratePlanId)?.name ?? row.ratePlanId)
                      : "All"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {row.roomTypeId
                      ? (roomTypeById.get(row.roomTypeId)?.name ?? row.roomTypeId)
                      : "All"}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {row.validFrom ?? "—"} → {row.validTo ?? "—"}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {row.minNights ?? "—"} / {row.maxNights ?? "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {row.closedToArrival ? <Badge variant="outline">CTA</Badge> : null}
                      {row.closedToDeparture ? <Badge variant="outline">CTD</Badge> : null}
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
                          if (confirm("Delete stay rule?")) {
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

      <StayRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        rule={editing}
      />
    </div>
  )
}
