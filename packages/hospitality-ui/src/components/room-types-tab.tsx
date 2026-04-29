"use client"

import { type RoomTypeRecord, useRoomTypeMutation, useRoomTypes } from "@voyantjs/hospitality-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { useHospitalityUiMessagesOrDefault } from "../i18n"
import type { InventoryMode } from "../i18n/messages"
import { PaginationFooter } from "./pagination-footer"
import { RoomTypeDialog } from "./room-type-dialog"

export interface RoomTypesTabProps {
  propertyId: string
}
const PAGE_SIZE = 25

export function RoomTypesTab({ propertyId }: RoomTypesTabProps) {
  const messages = useHospitalityUiMessagesOrDefault()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<RoomTypeRecord | undefined>(undefined)
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending } = useRoomTypes({
    propertyId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useRoomTypeMutation()

  const rows = (data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{messages.roomTypesTab.description}</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {messages.roomTypesTab.add}
        </Button>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{messages.roomTypesTab.empty}</p>
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">{messages.roomTypesTab.columns.name}</th>
                <th className="p-3 text-left font-medium">{messages.roomTypesTab.columns.code}</th>
                <th className="p-3 text-left font-medium">{messages.roomTypesTab.columns.mode}</th>
                <th className="p-3 text-left font-medium">
                  {messages.roomTypesTab.columns.occupancy}
                </th>
                <th className="p-3 text-left font-medium">
                  {messages.roomTypesTab.columns.status}
                </th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="p-3 font-medium">{row.name}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {row.code ?? messages.common.none}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="capitalize">
                      {messages.common.inventoryModeLabels[row.inventoryMode as InventoryMode]}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {row.standardOccupancy ?? messages.common.none} /{" "}
                    {row.maxOccupancy ?? messages.common.none}
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
                            confirm(messages.roomTypesTab.deleteConfirm.replace("{name}", row.name))
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

      <RoomTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        roomType={editing}
      />
    </div>
  )
}
