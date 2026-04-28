import { useQueries } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import {
  defaultFetcher,
  getFacilityQueryOptions,
  getPropertyQueryOptions,
  type PropertyGroupMemberRecord,
  usePropertyGroupMemberMutation,
  usePropertyGroupMembers,
} from "@voyantjs/facilities-react"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { PropertyGroupMemberDialog } from "./property-group-member-dialog"

const PAGE_SIZE = 10
const facilitiesClient = { baseUrl: "", fetcher: defaultFetcher }

type Props = { groupId: string }

export function MembersTab({ groupId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PropertyGroupMemberRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = usePropertyGroupMembers({
    groupId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = usePropertyGroupMemberMutation()
  const rows = data?.data ?? []

  const propertyQueries = useQueries({
    queries: rows.map((row) => ({
      ...getPropertyQueryOptions(facilitiesClient, row.propertyId),
      enabled: !!row.propertyId,
    })),
  })

  const facilityIds = Array.from(
    new Set(propertyQueries.map((query) => query.data?.facilityId).filter(Boolean)),
  ) as string[]

  const facilityQueries = useQueries({
    queries: facilityIds.map((facilityId) => ({
      ...getFacilityQueryOptions(facilitiesClient, facilityId),
      enabled: !!facilityId,
    })),
  })

  const propertyById = new Map(
    propertyQueries
      .map((query) => query.data)
      .filter((property): property is NonNullable<typeof property> => Boolean(property))
      .map((property) => [property.id, property]),
  )
  const facilityById = new Map(
    facilityQueries
      .map((query) => query.data)
      .filter((facility): facility is NonNullable<typeof facility> => Boolean(facility))
      .map((facility) => [facility.id, facility]),
  )

  const columns = useMemo<ColumnDef<PropertyGroupMemberRecord>[]>(
    () => [
      {
        id: "property",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Property" />,
        cell: ({ row }) => {
          const property = propertyById.get(row.original.propertyId)
          const facility = property ? facilityById.get(property.facilityId) : undefined
          return facility?.name ?? row.original.propertyId
        },
      },
      {
        accessorKey: "membershipRole",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.membershipRole}
          </Badge>
        ),
      },
      {
        accessorKey: "isPrimary",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Primary" />,
        cell: ({ row }) =>
          row.original.isPrimary ? <Badge variant="secondary">Primary</Badge> : "-",
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
                if (confirm("Remove member?")) {
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
    [facilityById, propertyById, refetch, remove],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Properties that belong to this group.</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        emptyMessage={isPending ? "Loading members..." : "No members yet."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <PropertyGroupMemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        groupId={groupId}
        member={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
