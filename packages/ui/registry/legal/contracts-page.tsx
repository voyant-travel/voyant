import type { QueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { formatMessage } from "@voyantjs/i18n"
import {
  defaultFetcher,
  getLegalContractsQueryOptions,
  type LegalContractRecord,
  useLegalContracts,
} from "@voyantjs/legal-react"
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
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

import { ContractDialog } from "./contract-dialog"
import { useRegistryLegalI18nOrDefault, useRegistryLegalMessagesOrDefault } from "./i18n/provider"
import { formatRegistryLegalDate } from "./i18n/utils"

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
    getLegalContractsQueryOptions(
      { baseUrl: "", fetcher: defaultFetcher },
      { search: "", scope: "all", status: "all", limit: PAGE_SIZE, offset: 0 },
    ),
  )
}

export function ContractsPage() {
  const navigate = useNavigate()
  const i18n = useRegistryLegalI18nOrDefault()
  const m = useRegistryLegalMessagesOrDefault()
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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={m.contractsPage.columns.number} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.contractNumber ?? m.common.noResultsDash}
          </span>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={m.contractsPage.columns.title} />
        ),
      },
      {
        accessorKey: "scope",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={m.contractsPage.columns.scope} />
        ),
        cell: ({ row }) => (
          <Badge variant="outline">
            {m.common.contractScopeLabels[
              row.original.scope as keyof typeof m.common.contractScopeLabels
            ] ?? row.original.scope}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={m.contractsPage.columns.status} />
        ),
        cell: ({ row }) => (
          <Badge variant={statusVariant[row.original.status] ?? "secondary"}>
            {m.common.contractStatusLabels[
              row.original.status as keyof typeof m.common.contractStatusLabels
            ] ?? row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "personId",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={m.contractsPage.columns.person} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.personId ?? m.common.noResultsDash}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={m.contractsPage.columns.created} />
        ),
        cell: ({ row }) => formatRegistryLegalDate(i18n, row.original.createdAt),
      },
    ],
    [i18n, m],
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{m.contractsPage.title}</h1>
          <p className="text-sm text-muted-foreground">{m.contractsPage.description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {m.contractsPage.create}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={m.contractsPage.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={scope} onValueChange={(v) => setScope(v ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={m.contractsPage.filters.scope} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.contractsPage.filters.allScopes}</SelectItem>
            {SCOPES.map((item) => (
              <SelectItem key={item} value={item}>
                {m.common.contractScopeLabels[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={m.contractsPage.filters.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.contractsPage.filters.allStatuses}</SelectItem>
            {STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {m.common.contractStatusLabels[item]}
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

      {data ? (
        <p className="text-sm text-muted-foreground">
          {formatMessage(m.contractsPage.summary, {
            shown: data.data.length,
            total: data.total,
          })}
        </p>
      ) : null}

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
