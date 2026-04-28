import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge, Button, Input } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Loader2, Plus, Search } from "lucide-react"
import { useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { ProductDialog } from "./product-dialog"

type ProductRow = {
  id: string
  name: string
  status: "draft" | "active" | "archived"
  sellCurrency: string
  sellAmountCents: number | null
  pax: number | null
  personId: string | null
  organizationId: string | null
  startDate: string | null
  createdAt: string
}

type ProductListResponse = {
  data: ProductRow[]
  total: number
  limit: number
  offset: number
}

export function getProductsListQueryOptions(search = "") {
  return {
    queryKey: ["products", search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      const qs = params.toString()

      return api.get<ProductListResponse>(`/v1/products${qs ? `?${qs}` : ""}`)
    },
  }
}

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  active: "default",
  archived: "secondary",
}

function formatAmount(cents: number | null, currency: string, noValue: string): string {
  if (cents == null) return noValue
  return `${(cents / 100).toFixed(2)} ${currency}`
}

export function ProductsPage() {
  const navigate = useNavigate()
  const messages = useAdminMessages().products
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isPending, refetch } = useQuery(getProductsListQueryOptions(search))
  const statusLabels: Record<ProductRow["status"], string> = {
    draft: messages.statusDraft,
    active: messages.statusActive,
    archived: messages.statusArchived,
  }
  const columns: ColumnDef<ProductRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title={messages.columnName} />,
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
      accessorKey: "sellAmountCents",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.columnSellAmount} />
      ),
      cell: ({ row }) =>
        formatAmount(row.original.sellAmountCents, row.original.sellCurrency, messages.noValue),
    },
    {
      accessorKey: "pax",
      header: ({ column }) => <DataTableColumnHeader column={column} title={messages.columnPax} />,
      cell: ({ row }) => row.original.pax ?? messages.noValue,
    },
    {
      accessorKey: "startDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.columnStartDate} />
      ),
      cell: ({ row }) => row.original.startDate ?? messages.noValue,
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
          onChange={(e) => setSearch(e.target.value)}
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
          onRowClick={(row) => {
            void navigate({ to: "/products/$id", params: { id: row.original.id } })
          }}
        />
      )}

      {data && (
        <p className="text-sm text-muted-foreground">
          {messages.showingSummary
            .replace("{count}", String(data.data.length))
            .replace("{total}", String(data.total))}
        </p>
      )}

      <ProductDialog
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
