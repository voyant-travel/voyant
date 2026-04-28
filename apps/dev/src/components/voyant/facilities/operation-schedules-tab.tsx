import type { ColumnDef } from "@tanstack/react-table"
import {
  type FacilityOperationScheduleRecord,
  useFacilityOperationScheduleMutation,
  useFacilityOperationSchedules,
} from "@voyantjs/facilities-react"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { OperationScheduleDialog } from "./operation-schedule-dialog"

const PAGE_SIZE = 10

const columns: ColumnDef<FacilityOperationScheduleRecord>[] = [
  {
    accessorKey: "dayOfWeek",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Day" />,
    cell: ({ row }) => <span className="capitalize">{row.original.dayOfWeek ?? "any"}</span>,
  },
  {
    accessorKey: "validFrom",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Valid from" />,
    cell: ({ row }) => row.original.validFrom ?? "-",
  },
  {
    accessorKey: "validTo",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Valid to" />,
    cell: ({ row }) => row.original.validTo ?? "-",
  },
  {
    accessorKey: "opensAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Opens" />,
    cell: ({ row }) => row.original.opensAt ?? "-",
  },
  {
    accessorKey: "closesAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Closes" />,
    cell: ({ row }) => row.original.closesAt ?? "-",
  },
  {
    accessorKey: "closed",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Closed" />,
    cell: ({ row }) => (row.original.closed ? <Badge variant="destructive">Closed</Badge> : "-"),
  },
]

type Props = { facilityId: string }

export function OperationSchedulesTab({ facilityId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FacilityOperationScheduleRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useFacilityOperationSchedules({
    facilityId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useFacilityOperationScheduleMutation()

  const actionColumns = useMemo<ColumnDef<FacilityOperationScheduleRecord>[]>(
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
                if (confirm("Delete schedule?")) {
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
        <p className="text-sm text-muted-foreground">Operating hours per weekday or date range.</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Schedule
        </Button>
      </div>

      <DataTable
        columns={actionColumns}
        data={data?.data ?? []}
        emptyMessage={isPending ? "Loading schedules..." : "No schedules yet."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <OperationScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        facilityId={facilityId}
        schedule={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
