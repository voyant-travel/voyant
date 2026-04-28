"use client"

import { useQueries } from "@tanstack/react-query"
import {
  getRoomTypeQueryOptions,
  type RoomInventoryRecord,
  useRoomInventory,
  useRoomInventoryMutation,
  useVoyantHospitalityContext,
} from "@voyantjs/hospitality-react"
import { Badge } from "@voyantjs/voyant-ui/components/badge"
import { Button } from "@voyantjs/voyant-ui/components/button"
import { Input } from "@voyantjs/voyant-ui/components/input"
import { Label } from "@voyantjs/voyant-ui/components/label"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { PaginationFooter } from "./pagination-footer"
import { RoomInventoryDialog } from "./room-inventory-dialog"
import { RoomTypeCombobox } from "./room-type-combobox"

export interface RoomInventoryTabProps {
  propertyId: string
}
const PAGE_SIZE = 25

export function RoomInventoryTab({ propertyId }: RoomInventoryTabProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<RoomInventoryRecord | undefined>(undefined)
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [roomTypeId, setRoomTypeId] = React.useState("")
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending } = useRoomInventory({
    propertyId,
    roomTypeId: roomTypeId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useRoomInventoryMutation()

  const rows = data?.data ?? []
  const { baseUrl, fetcher } = useVoyantHospitalityContext()
  const roomTypeIds = Array.from(new Set(rows.map((row) => row.roomTypeId)))
  if (roomTypeId) roomTypeIds.push(roomTypeId)
  const uniqueRoomTypeIds = Array.from(new Set(roomTypeIds))
  const roomTypeQueries = useQueries({
    queries: uniqueRoomTypeIds.map((id) => getRoomTypeQueryOptions({ baseUrl, fetcher }, id)),
  })
  const roomTypeById = new Map(
    roomTypeQueries.flatMap((query) => (query.data ? [[query.data.id, query.data]] : [])),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Daily unit availability per room type.</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Inventory
        </Button>
      </div>

      <div className="grid max-w-3xl grid-cols-3 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Room type</Label>
          <RoomTypeCombobox
            propertyId={propertyId}
            value={roomTypeId}
            onChange={(value) => {
              setRoomTypeId(value ?? "")
              setPageIndex(0)
            }}
            placeholder="All"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>From</Label>
          <Input
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value)
              setPageIndex(0)
            }}
            type="date"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>To</Label>
          <Input
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value)
              setPageIndex(0)
            }}
            type="date"
          />
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No inventory rows yet.</p>
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">Date</th>
                <th className="p-3 text-left font-medium">Room type</th>
                <th className="p-3 text-right font-medium">Total</th>
                <th className="p-3 text-right font-medium">Avail</th>
                <th className="p-3 text-right font-medium">Held</th>
                <th className="p-3 text-right font-medium">Sold</th>
                <th className="p-3 text-right font-medium">OOO</th>
                <th className="p-3 text-left font-medium">Stop</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="p-3 font-mono text-xs">{row.date}</td>
                  <td className="p-3 text-muted-foreground">
                    {roomTypeById.get(row.roomTypeId)?.name ?? row.roomTypeId}
                  </td>
                  <td className="p-3 text-right font-mono">{row.totalUnits}</td>
                  <td className="p-3 text-right font-mono">{row.availableUnits}</td>
                  <td className="p-3 text-right font-mono">{row.heldUnits}</td>
                  <td className="p-3 text-right font-mono">{row.soldUnits}</td>
                  <td className="p-3 text-right font-mono">{row.outOfOrderUnits}</td>
                  <td className="p-3">
                    {row.stopSell ? <Badge variant="destructive">Stop</Badge> : null}
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
                          if (confirm("Delete inventory row?")) {
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

      <RoomInventoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        inventory={editing}
      />
    </div>
  )
}
