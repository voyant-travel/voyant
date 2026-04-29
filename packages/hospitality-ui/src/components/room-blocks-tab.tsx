"use client"

import { useQueries } from "@tanstack/react-query"
import {
  getRoomTypeQueryOptions,
  getRoomUnitQueryOptions,
  type RoomBlockRecord,
  useRoomBlockMutation,
  useRoomBlocks,
  useVoyantHospitalityContext,
} from "@voyantjs/hospitality-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { useHospitalityUiMessagesOrDefault } from "../i18n"
import type { RoomBlockStatus } from "../i18n/messages"
import { PaginationFooter } from "./pagination-footer"
import { RoomBlockDialog } from "./room-block-dialog"

export interface RoomBlocksTabProps {
  propertyId: string
}
const PAGE_SIZE = 25

export function RoomBlocksTab({ propertyId }: RoomBlocksTabProps) {
  const messages = useHospitalityUiMessagesOrDefault()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<RoomBlockRecord | undefined>(undefined)
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending } = useRoomBlocks({
    propertyId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useRoomBlockMutation()
  const rows = data?.data ?? []
  const { baseUrl, fetcher } = useVoyantHospitalityContext()
  const roomTypeIds = Array.from(new Set(rows.map((row) => row.roomTypeId).filter(Boolean)))
  const roomUnitIds = Array.from(new Set(rows.map((row) => row.roomUnitId).filter(Boolean)))
  const roomTypeQueries = useQueries({
    queries: roomTypeIds.map((id) => getRoomTypeQueryOptions({ baseUrl, fetcher }, id!)),
  })
  const roomUnitQueries = useQueries({
    queries: roomUnitIds.map((id) => getRoomUnitQueryOptions({ baseUrl, fetcher }, id!)),
  })
  const roomTypeById = new Map(
    roomTypeQueries.flatMap((query) => (query.data ? [[query.data.id, query.data]] : [])),
  )
  const roomUnitById = new Map(
    roomUnitQueries.flatMap((query) => (query.data ? [[query.data.id, query.data]] : [])),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{messages.roomBlocksTab.description}</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {messages.roomBlocksTab.add}
        </Button>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{messages.roomBlocksTab.empty}</p>
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">
                  {messages.roomBlocksTab.columns.dates}
                </th>
                <th className="p-3 text-left font-medium">
                  {messages.roomBlocksTab.columns.roomTypeUnit}
                </th>
                <th className="p-3 text-left font-medium">
                  {messages.roomBlocksTab.columns.quantity}
                </th>
                <th className="p-3 text-left font-medium">
                  {messages.roomBlocksTab.columns.reason}
                </th>
                <th className="p-3 text-left font-medium">
                  {messages.roomBlocksTab.columns.status}
                </th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const roomType = row.roomTypeId ? roomTypeById.get(row.roomTypeId)?.name : null
                const roomUnit = row.roomUnitId
                  ? roomUnitById.get(row.roomUnitId)?.roomNumber
                  : null

                return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="p-3 font-mono text-xs">
                      {row.startsOn} → {row.endsOn}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {roomType ??
                        roomUnit ??
                        row.roomTypeId ??
                        row.roomUnitId ??
                        messages.common.none}
                    </td>
                    <td className="p-3 font-mono">{row.quantity}</td>
                    <td className="p-3 text-muted-foreground">
                      {row.blockReason ?? messages.common.none}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">
                        {messages.common.roomBlockStatusLabels[row.status as RoomBlockStatus]}
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
                            if (confirm(messages.roomBlocksTab.deleteConfirm)) {
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

      <RoomBlockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        block={editing}
      />
    </div>
  )
}
