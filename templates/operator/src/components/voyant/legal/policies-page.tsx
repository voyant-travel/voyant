import type { QueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import {
  getLegalPoliciesQueryOptions,
  type LegalPolicyRecord,
  useLegalPolicies,
} from "@voyantjs/legal-react"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Loader2, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { legalQueryClient } from "./legal-query-client"
import { PolicyDialog } from "./policy-dialog"

const KINDS = [
  "cancellation",
  "payment",
  "terms_and_conditions",
  "privacy",
  "refund",
  "commission",
  "guarantee",
  "other",
] as const
const PAGE_SIZE = 25

export function loadPoliciesPage(queryClient: QueryClient) {
  return queryClient.ensureQueryData(
    getLegalPoliciesQueryOptions(legalQueryClient, {
      search: "",
      kind: "all",
      limit: PAGE_SIZE,
      offset: 0,
    }),
  )
}

export function PoliciesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isPending, refetch } = useLegalPolicies({
    search,
    kind,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })

  const columns = useMemo<ColumnDef<LegalPolicyRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      },
      {
        accessorKey: "slug",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Slug" />,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.slug}</span>,
      },
      {
        accessorKey: "kind",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Kind" />,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.kind.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "language",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Language" />,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policies</h1>
          <p className="text-sm text-muted-foreground">
            Manage cancellation, payment, and other legal policies.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Policy
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search policies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={kind} onValueChange={(v) => setKind(v ?? "all")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k} className="capitalize">
                {k.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            void navigate({ to: "/legal/policies/$id", params: { id: row.original.id } })
          }}
        />
      )}

      {data && (
        <p className="text-sm text-muted-foreground">
          Showing {data.data.length} of {data.total} policies
        </p>
      )}

      <PolicyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false)
          setPageIndex(0)
          void refetch()
        }}
      />
    </div>
  )
}
