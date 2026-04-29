"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type NamedContactRecord,
  useNamedContactMutation,
  useNamedContacts,
} from "@voyantjs/identity-react"
import { Pencil, Plus, Star, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { useIdentityUiMessagesOrDefault } from "../../../identity-ui/src/index"

import { useRegistryIdentityMessagesOrDefault } from "./i18n"
import { NamedContactDialog } from "./named-contact-dialog"

export interface NamedContactsTabProps {
  entityType: string
  entityId: string
}

const PAGE_SIZE = 25

export function NamedContactsTab({ entityType, entityId }: NamedContactsTabProps) {
  const sharedMessages = useIdentityUiMessagesOrDefault()
  const tabMessages = useRegistryIdentityMessagesOrDefault().namedContactsTab
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<NamedContactRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useNamedContacts({
    entityType,
    entityId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
    enabled: Boolean(entityType) && Boolean(entityId),
  })
  const { remove } = useNamedContactMutation()

  const columns = useMemo<ColumnDef<NamedContactRecord>[]>(
    () => [
      {
        accessorKey: "role",
        header: tabMessages.columns.role,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {sharedMessages.common.namedContactRoleLabels[row.original.role]}
          </Badge>
        ),
      },
      {
        accessorKey: "name",
        header: tabMessages.columns.name,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "title",
        header: tabMessages.columns.title,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.title ?? "-"}</span>
        ),
      },
      {
        accessorKey: "email",
        header: tabMessages.columns.email,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email ?? "-"}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: tabMessages.columns.phone,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.phone ?? "-"}</span>
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
    [refetch, remove, sharedMessages.common.namedContactRoleLabels, tabMessages],
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

      <NamedContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
        namedContact={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
