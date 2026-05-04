import type { QueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { usePerson } from "@voyantjs/crm-react"
import {
  getLegalContractsQueryOptions,
  type LegalContractRecord,
  useLegalContracts,
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
import { ContractDialog } from "./contract-dialog"
import { legalQueryClient } from "./legal-query-client"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  issued: "secondary",
  sent: "secondary",
  signed: "default",
  executed: "default",
  expired: "destructive",
  void: "destructive",
}

const SCOPES = ["customer", "supplier", "partner", "channel", "other"] as const
const STATUSES = ["draft", "issued", "sent", "signed", "executed", "expired", "void"] as const
const PAGE_SIZE = 25

type EnsureQueryData = QueryClient["ensureQueryData"]

export function loadContractsPage(ensureQueryData: EnsureQueryData) {
  return ensureQueryData(
    getLegalContractsQueryOptions(legalQueryClient, {
      search: "",
      scope: "all",
      status: "all",
      limit: PAGE_SIZE,
      offset: 0,
    }),
  )
}

export function ContractsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [scope, setScope] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isPending, refetch } = useLegalContracts({
    search,
    scope,
    status,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })

  const columns = useMemo<ColumnDef<LegalContractRecord>[]>(
    () => [
      {
        accessorKey: "contractNumber",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Number" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.contractNumber ?? "-"}</span>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
      },
      {
        accessorKey: "scope",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Scope" />,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.scope}
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
        accessorKey: "personId",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Person" />,
        cell: ({ row }) => <PersonNameCell personId={row.original.personId} />,
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
          <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            Manage legal contracts across customers, suppliers, and partners.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Contract
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={scope} onValueChange={(v) => setScope(v ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scopes</SelectItem>
            {SCOPES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
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
            void navigate({ to: "/legal/contracts/$id", params: { id: row.original.id } })
          }}
        />
      )}

      {data && (
        <p className="text-sm text-muted-foreground">
          Showing {data.data.length} of {data.total} contracts
        </p>
      )}

      <ContractDialog
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

/**
 * Render the person column for one contract row. Resolves the
 * person id to "First Last" client-side via the CRM hook so
 * operators see a name instead of `pers_…` typeids.
 *
 * Lives as its own component (not an inline function inside the
 * column `cell`) because hooks can't be called from a `cell`
 * arrow without re-rendering the whole table on each row's state
 * change. React Query dedupes identical person fetches across
 * rows, so multiple contracts for the same person make exactly
 * one network call.
 */
function PersonNameCell({ personId }: { personId: string | null }): React.ReactElement {
  const { data, isLoading } = usePerson(personId ?? undefined, {
    enabled: Boolean(personId),
  })
  if (!personId) return <span className="text-muted-foreground">—</span>
  if (isLoading) return <span className="text-muted-foreground text-xs">…</span>
  if (!data) {
    // 404 / error — fall back to the truncated id so we show
    // something rather than a permanent loader.
    return (
      <span className="font-mono text-xs text-muted-foreground" title={personId}>
        {personId.slice(0, 16)}…
      </span>
    )
  }
  const name = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim()
  return <span className="text-sm">{name || personId.slice(0, 16)}</span>
}
