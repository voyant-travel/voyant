import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Loader2, Plus, Search } from "lucide-react"
import { useState } from "react"
import { Badge, Button, Input } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { useAdminMessages } from "@/lib/admin-i18n"
import { getSuppliersQueryOptions, type Supplier, statusVariant } from "./shared"
import { SupplierDialog } from "./supplier-dialog"

const PAGE_SIZE = 25

export function SuppliersPage() {
  const navigate = useNavigate()
  const messages = useAdminMessages().suppliersModule
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
  const typeLabels: Record<Supplier["type"], string> = {
    hotel: messages.typeHotel,
    transfer: messages.typeTransfer,
    guide: messages.typeGuide,
    experience: messages.typeExperience,
    airline: messages.typeAirline,
    restaurant: messages.typeRestaurant,
    other: messages.typeOther,
  }
  const statusLabels: Record<Supplier["status"], string> = {
    active: messages.statusActive,
    inactive: messages.statusInactive,
    pending: messages.statusPending,
  }
  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title={messages.columnName} />,
    },
    {
      accessorKey: "type",
      header: ({ column }) => <DataTableColumnHeader column={column} title={messages.columnType} />,
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {typeLabels[row.original.type] ?? row.original.type}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.columnStatus} />
      ),
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status] ?? "secondary"} className="capitalize">
          {statusLabels[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "city",
      header: ({ column }) => <DataTableColumnHeader column={column} title={messages.columnCity} />,
      cell: ({ row }) => row.original.city ?? messages.noValue,
    },
    {
      accessorKey: "country",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.columnCountry} />
      ),
      cell: ({ row }) => row.original.country ?? messages.noValue,
    },
    {
      accessorKey: "defaultCurrency",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.columnCurrency} />
      ),
      cell: ({ row }) => row.original.defaultCurrency ?? messages.noValue,
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{messages.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{messages.pageDescription}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {messages.newAction}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={messages.searchPlaceholder}
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
