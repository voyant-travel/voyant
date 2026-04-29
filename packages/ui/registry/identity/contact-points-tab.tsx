"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type ContactPointRecord,
  useContactPointMutation,
  useContactPoints,
} from "@voyantjs/identity-react"
import { Pencil, Plus, Star, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { useIdentityUiMessagesOrDefault } from "../../../identity-ui/src/index"

import { ContactPointDialog } from "./contact-point-dialog"
import { useRegistryIdentityMessagesOrDefault } from "./i18n"

export interface ContactPointsTabProps {
  entityType: string
  entityId: string
}

const PAGE_SIZE = 25

export function ContactPointsTab({ entityType, entityId }: ContactPointsTabProps) {
  const sharedMessages = useIdentityUiMessagesOrDefault()
  const tabMessages = useRegistryIdentityMessagesOrDefault().contactPointsTab
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ContactPointRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useContactPoints({
    entityType,
    entityId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
    enabled: Boolean(entityType) && Boolean(entityId),
  })
  const { remove } = useContactPointMutation()

  const columns = useMemo<ColumnDef<ContactPointRecord>[]>(
    () => [
      {
        accessorKey: "kind",
        header: tabMessages.columns.kind,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {sharedMessages.common.contactPointKindLabels[row.original.kind]}
          </Badge>
        ),
      },
      {
        accessorKey: "value",
        header: tabMessages.columns.value,
        cell: ({ row }) => <span className="font-medium">{row.original.value}</span>,
      },
      {
        accessorKey: "label",
        header: tabMessages.columns.label,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.label ?? "-"}</span>
        ),
      },
      {
        accessorKey: "isPrimary",
        header: tabMessages.columns.primary,
        cell: ({ row }) =>
          row.original.isPrimary ? (
            <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
          ) : null,
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
    [refetch, remove, sharedMessages.common.contactPointKindLabels, tabMessages],
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

      <ContactPointDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
        contactPoint={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
