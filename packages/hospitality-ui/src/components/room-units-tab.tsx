"use client"

import { useQueries } from "@tanstack/react-query"
import {
  getRoomTypeQueryOptions,
  type RoomUnitRecord,
  useRoomUnitMutation,
  useRoomUnits,
  useVoyantHospitalityContext,
} from "@voyantjs/hospitality-react"
import { Badge } from "@voyantjs/voyant-ui/components/badge"
import { Button } from "@voyantjs/voyant-ui/components/button"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { PaginationFooter } from "./pagination-footer"
import { RoomUnitDialog } from "./room-unit-dialog"

export interface RoomUnitsTabProps {
  propertyId: string
}
const PAGE_SIZE = 25

export function RoomUnitsTab({ propertyId }: RoomUnitsTabProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<RoomUnitRecord | undefined>(undefined)
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending } = useRoomUnits({
    propertyId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useRoomUnitMutation()
  const rows = data?.data ?? []
  const { baseUrl, fetcher } = useVoyantHospitalityContext()
  const roomTypeIds = Array.from(new Set(rows.map((row) => row.roomTypeId)))
  const roomTypeQueries = useQueries({
    queries: roomTypeIds.map((id) => getRoomTypeQueryOptions({ baseUrl, fetcher }, id)),
  })
  const roomTypeById = new Map(
    roomTypeQueries.flatMap((query) => (query.data ? [[query.data.id, query.data]] : [])),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Physical rooms that belong to a room type.</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Room Unit
        </Button>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No room units yet.</p>
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">Room #</th>
                <th className="p-3 text-left font-medium">Room type</th>
                <th className="p-3 text-left font-medium">Floor</th>
                <th className="p-3 text-left font-medium">Wing</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="p-3 font-medium">{row.roomNumber ?? row.code ?? row.id}</td>
                  <td className="p-3 text-muted-foreground">
                    {roomTypeById.get(row.roomTypeId)?.name ?? row.roomTypeId}
                  </td>
                  <td className="p-3 text-muted-foreground">{row.floor ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{row.wing ?? "—"}</td>
                  <td className="p-3">
                    <Badge
                      variant={row.status === "active" ? "default" : "outline"}
                      className="capitalize"
                    >
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
                          if (confirm(`Delete room unit "${row.roomNumber ?? row.id}"?`)) {
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

      <RoomUnitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        unit={editing}
      />
    </div>
  )
}
