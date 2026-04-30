import { useQueries } from "@tanstack/react-query"
import {
  getRatePlanQueryOptions,
  getRoomTypeQueryOptions,
  type StayBookingItemRecord,
  useStayBookingItemMutation,
  useStayBookingItems,
  useVoyantHospitalityContext,
} from "@voyantjs/hospitality-react"
import { PaginationFooter } from "@voyantjs/hospitality-ui/components/pagination-footer"
import { Badge, Button } from "@voyantjs/ui/components"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { type StayBookingItemData, StayBookingItemDialog } from "./stay-booking-item-dialog"

type Props = { propertyId: string }
const PAGE_SIZE = 25

export function StayBookingItemsTab({ propertyId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StayBookingItemData | undefined>()
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isPending } = useStayBookingItems({
    propertyId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useStayBookingItemMutation()
  const { baseUrl, fetcher } = useVoyantHospitalityContext()

  const rows = (data?.data ?? []) as StayBookingItemRecord[]
  const roomTypeIds = Array.from(new Set(rows.map((row) => row.roomTypeId)))
  const ratePlanIds = Array.from(new Set(rows.map((row) => row.ratePlanId)))
  const roomTypeQueries = useQueries({
    queries: roomTypeIds.map((id) => getRoomTypeQueryOptions({ baseUrl, fetcher }, id)),
  })
  const ratePlanQueries = useQueries({
    queries: ratePlanIds.map((id) => getRatePlanQueryOptions({ baseUrl, fetcher }, id)),
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
          Stays attached to a booking item — one row per check-in/check-out window.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Stay
        </Button>
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isPending && rows.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No stay booking items yet.</p>
        </div>
      )}

      {!isPending && rows.length > 0 && (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">Check-in</th>
                <th className="p-3 text-left font-medium">Check-out</th>
                <th className="p-3 text-left font-medium">Nights</th>
                <th className="p-3 text-left font-medium">Room type</th>
                <th className="p-3 text-left font-medium">Rate plan</th>
                <th className="p-3 text-left font-medium">Pax</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="p-3 font-mono text-xs">{row.checkInDate}</td>
                  <td className="p-3 font-mono text-xs">{row.checkOutDate}</td>
                  <td className="p-3 font-mono">{row.nightCount}</td>
                  <td className="p-3 text-muted-foreground">
                    {roomTypeById.get(row.roomTypeId)?.name ?? row.roomTypeId}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {ratePlanById.get(row.ratePlanId)?.name ?? row.ratePlanId}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {row.adults}A/{row.children}C/{row.infants}I
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="capitalize">
                      {row.status.replace(/_/g, " ")}
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
                          if (confirm("Delete stay?")) {
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

      <StayBookingItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        item={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
        }}
      />
    </div>
  )
}
