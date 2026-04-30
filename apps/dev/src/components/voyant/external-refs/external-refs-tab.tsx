import type { ColumnDef } from "@tanstack/react-table"
import {
  type ExternalRefRecord,
  useExternalRefMutation,
  useExternalRefs,
} from "@voyantjs/external-refs-react"
import { ExternalRefDialog } from "@voyantjs/external-refs-ui/components/external-ref-dialog"
import { Pencil, Plus, Star, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

type Props = { entityType: string; entityId: string }
const PAGE_SIZE = 25

export function ExternalRefsTab({ entityType, entityId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ExternalRefRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useExternalRefs({
    entityType,
    entityId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
    enabled: Boolean(entityType) && Boolean(entityId),
  })
  const { remove } = useExternalRefMutation()

  const columns = useMemo<ColumnDef<ExternalRefRecord>[]>(
    () => [
      {
        accessorKey: "sourceSystem",
        header: "Source System",
        cell: ({ row }) => <span className="font-medium">{row.original.sourceSystem}</span>,
      },
      {
        accessorKey: "objectType",
        header: "Object Type",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.objectType}</span>,
      },
      {
        accessorKey: "externalId",
        header: "External ID",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.externalId}</span>,
      },
      {
        accessorKey: "namespace",
        header: "Namespace",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.namespace}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "active" ? "default" : "outline"}
            className="capitalize"
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "isPrimary",
        header: "Primary",
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
                if (confirm(`Delete external ref "${row.original.externalId}"?`)) {
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
    [refetch, remove],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Links between this entity and IDs in external systems.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add External Ref
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        emptyMessage={isPending ? "Loading external references..." : "No external references yet."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <ExternalRefDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
        externalRef={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
