import type { ColumnDef } from "@tanstack/react-table"
import { type AddressRecord, useAddresses, useAddressMutation } from "@voyantjs/identity-react"
import { AddressDialog } from "@voyantjs/identity-ui/components/address-dialog"
import { Pencil, Plus, Star, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

type Props = { entityType: string; entityId: string }
const PAGE_SIZE = 25

export function AddressesTab({ entityType, entityId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AddressRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useAddresses({
    entityType,
    entityId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
    enabled: Boolean(entityType) && Boolean(entityId),
  })
  const { remove } = useAddressMutation()

  const columns = useMemo<ColumnDef<AddressRecord>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Label",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.label}
          </Badge>
        ),
      },
      {
        accessorKey: "line1",
        header: "Street",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.line1 ?? "-"}</span>
        ),
      },
      {
        accessorKey: "city",
        header: "City",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.city ?? "-"}</span>
        ),
      },
      {
        accessorKey: "country",
        header: "Country",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.country ?? "-"}
          </span>
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
                if (confirm("Delete address?")) {
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
          Physical and postal addresses associated with this entity.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Address
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        emptyMessage={isPending ? "Loading addresses..." : "No addresses yet."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <AddressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
        address={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
