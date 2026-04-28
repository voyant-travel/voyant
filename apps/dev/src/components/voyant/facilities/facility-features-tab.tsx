import type { ColumnDef } from "@tanstack/react-table"
import {
  type FacilityFeatureRecord,
  useFacilityFeatureMutation,
  useFacilityFeatures,
} from "@voyantjs/facilities-react"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { FacilityFeatureDialog } from "./facility-feature-dialog"

const PAGE_SIZE = 10

const columns: ColumnDef<FacilityFeatureRecord>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
  },
  {
    accessorKey: "category",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.category}
      </Badge>
    ),
  },
  {
    accessorKey: "code",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    cell: ({ row }) => row.original.code ?? "-",
  },
  {
    accessorKey: "valueText",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Value" />,
    cell: ({ row }) => row.original.valueText ?? "-",
  },
  {
    accessorKey: "highlighted",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Highlighted" />,
    cell: ({ row }) =>
      row.original.highlighted ? <Badge variant="secondary">Featured</Badge> : "-",
  },
]

type Props = { facilityId: string }

export function FacilityFeaturesTab({ facilityId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FacilityFeatureRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useFacilityFeatures({
    facilityId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useFacilityFeatureMutation()

  const rows = useMemo(
    () => (data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [data?.data],
  )

  const actionColumns = useMemo<ColumnDef<FacilityFeatureRecord>[]>(
    () => [
      ...columns,
      {
        id: "actions",
        header: () => <div className="w-20" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setEditing(row.original)
                setDialogOpen(true)
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                if (confirm(`Delete feature "${row.original.name}"?`)) {
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
          Amenities, accessibility, service levels, and policies attached to this facility.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Feature
        </Button>
      </div>

      <DataTable
        columns={actionColumns}
        data={rows}
        emptyMessage={isPending ? "Loading features..." : "No features yet."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <FacilityFeatureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        facilityId={facilityId}
        feature={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
