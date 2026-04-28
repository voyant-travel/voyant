import { useQueries } from "@tanstack/react-query"
import {
  getRoomUnitQueryOptions,
  type StayOperationRecord,
  useStayOperationMutation,
  useStayOperations,
  useVoyantHospitalityContext,
} from "@voyantjs/hospitality-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { PaginationFooter } from "./pagination-footer"
import { type StayOperationData, StayOperationDialog } from "./stay-operation-dialog"

type Props = { propertyId: string }
const PAGE_SIZE = 25

const formatDateTime = (iso: string | null): string => {
  if (!iso) return "-"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleString()
}

export function StayOperationsTab({ propertyId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StayOperationData | undefined>()
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isPending } = useStayOperations({
    propertyId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useStayOperationMutation()
  const { baseUrl, fetcher } = useVoyantHospitalityContext()

  const rows = (data?.data ?? []) as StayOperationRecord[]
  const roomUnitIds = Array.from(new Set(rows.map((row) => row.roomUnitId).filter(Boolean)))
  const roomUnitQueries = useQueries({
    queries: roomUnitIds.map((id) => getRoomUnitQueryOptions({ baseUrl, fetcher }, id!)),
  })
  const roomUnitById = new Map(
    roomUnitQueries.flatMap((query) => (query.data ? [[query.data.id, query.data]] : [])),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Day-of-stay operational state: arrival, check-in/out, no-show.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Operation
        </Button>
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isPending && rows.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No stay operations yet.</p>
        </div>
      )}

      {!isPending && rows.length > 0 && (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">Stay booking item</th>
                <th className="p-3 text-left font-medium">Room unit</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Expected arrival</th>
                <th className="p-3 text-left font-medium">Checked in</th>
                <th className="p-3 text-left font-medium">Checked out</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const ru = row.roomUnitId ? roomUnitById.get(row.roomUnitId) : null
                return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="p-3 font-mono text-xs">{row.stayBookingItemId}</td>
                    <td className="p-3 text-muted-foreground">
                      {ru ? (ru.roomNumber ?? ru.code ?? ru.id) : "-"}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="capitalize">
                        {row.operationStatus.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {formatDateTime(row.expectedArrivalAt)}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {formatDateTime(row.checkedInAt)}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {formatDateTime(row.checkedOutAt)}
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
                            if (confirm("Delete operation?")) {
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

      <StayOperationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        operation={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
        }}
      />
    </div>
  )
}
