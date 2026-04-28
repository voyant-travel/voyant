import { useQueries } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { type PropertyRecord, useProperties, usePropertyMutation } from "@voyantjs/facilities-react"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Building2, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button, Label } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PropertyDialog } from "./property-dialog"
import { getFacilityQueryOptions, PROPERTY_TYPES } from "./property-shared"

const PAGE_SIZE = 25

const columns: ColumnDef<PropertyRecord>[] = [
  {
    accessorKey: "facilityId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Facility" />,
  },
  {
    accessorKey: "propertyType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.propertyType}
      </Badge>
    ),
  },
  {
    accessorKey: "brandName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Brand" />,
    cell: ({ row }) => row.original.brandName ?? "-",
  },
  {
    accessorKey: "rating",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Rating" />,
    cell: ({ row }) =>
      row.original.rating != null
        ? `${row.original.rating}${row.original.ratingScale ? ` / ${row.original.ratingScale}` : ""}`
        : "-",
  },
  {
    accessorKey: "checkInTime",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Check-in" />,
    cell: ({ row }) => row.original.checkInTime ?? "-",
  },
  {
    accessorKey: "checkOutTime",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Check-out" />,
    cell: ({ row }) => row.original.checkOutTime ?? "-",
  },
]

export function PropertiesPage() {
  const navigate = useNavigate()
  const [propertyType, setPropertyType] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PropertyRecord | undefined>()
  const { data, isPending, refetch } = useProperties({
    propertyType: propertyType || undefined,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = usePropertyMutation()

  const facilityIds = useMemo(
    () => Array.from(new Set((data?.data ?? []).map((row) => row.facilityId))),
    [data?.data],
  )
  const facilityQueries = useQueries({
    queries: facilityIds.map((facilityId) => getFacilityQueryOptions(facilityId)),
  })
  const facilityById = useMemo(() => {
    const map = new Map<string, string>()
    for (const query of facilityQueries) {
      if (query.data) {
        map.set(query.data.id, query.data.name)
      }
    }
    return map
  }, [facilityQueries])

  const actionColumns = useMemo<ColumnDef<PropertyRecord>[]>(
    () => [
      {
        ...columns[0],
        cell: ({ row }) => facilityById.get(row.original.facilityId) ?? row.original.facilityId,
      },
      ...columns.slice(1),
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
                if (confirm("Delete property?")) {
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
    [facilityById, refetch, remove],
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Property
        </Button>
      </div>

      <div className="grid max-w-sm grid-cols-1 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Property type</Label>
          <Select
            items={[
              { label: "All types", value: "all" },
              ...PROPERTY_TYPES.map((type) => ({ label: type, value: type })),
            ]}
            value={propertyType || "all"}
            onValueChange={(value) => {
              setPropertyType(value === "all" ? "" : (value ?? ""))
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {PROPERTY_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={actionColumns}
        data={data?.data ?? []}
        emptyMessage={isPending ? "Loading properties..." : "No properties yet."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
        onRowClick={(row) => {
          void navigate({ to: "/properties/$id", params: { id: row.original.id } })
        }}
      />

      <PropertyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        property={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
