import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import {
  type PropertyGroupRecord,
  usePropertyGroupMutation,
  usePropertyGroups,
} from "@voyantjs/facilities-react"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Building, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button, Input, Label } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PropertyGroupDialog } from "./property-group-dialog"
import { PROPERTY_GROUP_STATUSES, PROPERTY_GROUP_TYPES } from "./property-group-shared"

const PAGE_SIZE = 25

const columns: ColumnDef<PropertyGroupRecord>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
  },
  {
    accessorKey: "code",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    cell: ({ row }) => row.original.code ?? "-",
  },
  {
    accessorKey: "groupType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.groupType.replace(/_/g, " ")}
      </Badge>
    ),
  },
  {
    accessorKey: "brandName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Brand" />,
    cell: ({ row }) => row.original.brandName ?? "-",
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant={row.original.status === "active" ? "default" : "outline"}>
        {row.original.status}
      </Badge>
    ),
  },
]

export function PropertyGroupsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [groupType, setGroupType] = useState("")
  const [status, setStatus] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PropertyGroupRecord | undefined>()
  const { data, isPending, refetch } = usePropertyGroups({
    search: search || undefined,
    groupType: groupType || undefined,
    status: status || undefined,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = usePropertyGroupMutation()

  const actionColumns = useMemo<ColumnDef<PropertyGroupRecord>[]>(
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
                if (confirm(`Delete group "${row.original.name}"?`)) {
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Building className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Property Groups</h1>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Group
        </Button>
      </div>

      <div className="grid max-w-4xl grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Search</Label>
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPageIndex(0)
            }}
            placeholder="Name or code..."
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Type</Label>
          <Select
            items={[
              { label: "All types", value: "all" },
              ...PROPERTY_GROUP_TYPES.map((type) => ({
                label: type.replace(/_/g, " "),
                value: type,
              })),
            ]}
            value={groupType || "all"}
            onValueChange={(value) => {
              setGroupType(value && value !== "all" ? value : "")
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {PROPERTY_GROUP_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Select
            items={[
              { label: "All statuses", value: "all" },
              ...PROPERTY_GROUP_STATUSES.map((item) => ({ label: item, value: item })),
            ]}
            value={status || "all"}
            onValueChange={(value) => {
              setStatus(value && value !== "all" ? value : "")
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PROPERTY_GROUP_STATUSES.map((item) => (
                <SelectItem key={item} value={item} className="capitalize">
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={actionColumns}
        data={data?.data ?? []}
        emptyMessage={isPending ? "Loading property groups..." : "No property groups yet."}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageIndexChange: setPageIndex,
        }}
        onRowClick={(row) => {
          void navigate({ to: "/property-groups/$id", params: { id: row.original.id } })
        }}
      />

      <PropertyGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        group={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
