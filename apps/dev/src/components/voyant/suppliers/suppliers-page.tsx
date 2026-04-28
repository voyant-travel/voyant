import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Loader2, Plus, Search } from "lucide-react"
import { useState } from "react"
import { Badge, Button, Input } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { getSuppliersQueryOptions, type Supplier, statusVariant } from "./shared"
import { SupplierDialog } from "./supplier-dialog"

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

const PAGE_SIZE = 25

export function SuppliersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data, isPending, refetch } = useQuery(
    getSuppliersQueryOptions({
      search: search || undefined,
      limit: PAGE_SIZE,
      offset: pageIndex * PAGE_SIZE,
    }),
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your hotels, transfers, guides, and service providers.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Supplier
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search suppliers..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPageIndex(0)
          }}
          className="pl-9"
        />
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          pagination={{
            pageIndex,
            pageSize: PAGE_SIZE,
            total: data?.total ?? 0,
            onPageIndexChange: setPageIndex,
          }}
          onRowClick={(row) => {
            void navigate({ to: "/suppliers/$id", params: { id: row.original.id } })
          }}
        />
      )}

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false)
          void refetch()
        }}
      />
    </div>
  )
}
