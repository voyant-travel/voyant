"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type GroundOperatorRecord,
  useGroundOperatorMutation,
  useGroundOperators,
} from "@voyantjs/ground-react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { useRegistryGroundMessagesOrDefault } from "./i18n"
import { OperatorDialog } from "./operator-dialog"

const PAGE_SIZE = 25

export function OperatorsTab() {
  const messages = useRegistryGroundMessagesOrDefault()
  const tabMessages = messages.operatorsTab
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GroundOperatorRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useGroundOperators({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useGroundOperatorMutation()

  const columns = useMemo<ColumnDef<GroundOperatorRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: tabMessages.columns.name,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "code",
        header: tabMessages.columns.code,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.code ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "supplierId",
        header: tabMessages.columns.supplier,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.supplierId ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "facilityId",
        header: tabMessages.columns.facility,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.facilityId ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "active",
        header: tabMessages.columns.status,
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "default" : "outline"}>
            {row.original.active ? messages.common.active : messages.common.inactive}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => <div className="w-20" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setEditing(row.original)
                setDialogOpen(true)
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(tabMessages.actions.deleteConfirm)) {
                  remove.mutate(row.original.id, { onSuccess: () => void refetch() })
                }
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [messages.common.active, messages.common.inactive, refetch, remove, tabMessages],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tabMessages.description}</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {tabMessages.add}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        emptyMessage={isPending ? tabMessages.empty.loading : tabMessages.empty.none}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <OperatorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        operator={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
