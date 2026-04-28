import type { ColumnDef } from "@tanstack/react-table"
import type { Supplier } from "@voyantjs/suppliers-react"
import { statusVariant } from "@voyantjs/suppliers-react"
import { Badge, Button, Input } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Loader2, Plus, Search } from "lucide-react"

const columns: ColumnDef<Supplier>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
  },
  {
    accessorKey: "type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.type}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.original.status] ?? "secondary"} className="capitalize">
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "city",
    header: ({ column }) => <DataTableColumnHeader column={column} title="City" />,
    cell: ({ row }) => row.original.city ?? "-",
  },
  {
    accessorKey: "country",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Country" />,
    cell: ({ row }) => row.original.country ?? "-",
  },
  {
    accessorKey: "defaultCurrency",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Currency" />,
    cell: ({ row }) => row.original.defaultCurrency ?? "-",
  },
]

export function SuppliersPage({
  search,
  onSearchChange,
  onCreate,
  onRowClick,
  rows,
  total,
  isPending,
}: {
  search: string
  onSearchChange: (value: string) => void
  onCreate: () => void
  onRowClick: (supplier: Supplier) => void
  rows: Supplier[]
  total: number
  isPending?: boolean
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your hotels, transfers, guides, and service providers.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Supplier
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search suppliers..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
        />
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable columns={columns} data={rows} onRowClick={(row) => onRowClick(row.original)} />
      )}

      <p className="text-sm text-muted-foreground">
        Showing {rows.length} of {total} suppliers
      </p>
    </div>
  )
}
