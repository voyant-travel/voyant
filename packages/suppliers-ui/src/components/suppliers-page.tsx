import type { ColumnDef } from "@tanstack/react-table"
import type { Supplier } from "@voyantjs/suppliers-react"
import { statusVariant } from "@voyantjs/suppliers-react"
import { Badge, Button, Input } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Loader2, Plus, Search } from "lucide-react"

import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"

function useSupplierColumns(): ColumnDef<Supplier>[] {
  const messages = useSuppliersUiMessagesOrDefault()

  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.suppliersPage.columns.name} />
      ),
    },
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.suppliersPage.columns.type} />
      ),
      cell: ({ row }) => (
        <Badge variant="outline">{messages.common.supplierTypeLabels[row.original.type]}</Badge>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.suppliersPage.columns.status} />
      ),
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status] ?? "secondary"}>
          {messages.common.supplierStatusLabels[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: "city",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.suppliersPage.columns.city} />
      ),
      cell: ({ row }) => row.original.city ?? messages.common.none,
    },
    {
      accessorKey: "country",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.suppliersPage.columns.country} />
      ),
      cell: ({ row }) => row.original.country ?? messages.common.none,
    },
    {
      accessorKey: "defaultCurrency",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.suppliersPage.columns.currency} />
      ),
      cell: ({ row }) => row.original.defaultCurrency ?? messages.common.none,
    },
  ]
}

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
  const messages = useSuppliersUiMessagesOrDefault()
  const columns = useSupplierColumns()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{messages.suppliersPage.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.suppliersPage.description}</p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {messages.suppliersPage.create}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={messages.suppliersPage.searchPlaceholder}
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
        {messages.suppliersPage.summary
          .replace("{shown}", String(rows.length))
          .replace("{total}", String(total))}
      </p>
    </div>
  )
}
