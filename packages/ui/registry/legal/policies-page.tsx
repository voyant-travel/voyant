import type { QueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { formatMessage } from "@voyantjs/i18n"
import {
  defaultFetcher,
  getLegalPoliciesQueryOptions,
  type LegalPolicyRecord,
  useLegalPolicies,
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

import { useRegistryLegalI18nOrDefault, useRegistryLegalMessagesOrDefault } from "./i18n/provider"
import { formatRegistryLegalDate } from "./i18n/utils"
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
type EnsureQueryData = QueryClient["ensureQueryData"]

export function loadPoliciesPage(ensureQueryData: EnsureQueryData) {
  return ensureQueryData(
    getLegalPoliciesQueryOptions(
      { baseUrl: "", fetcher: defaultFetcher },
      { search: "", kind: "all", limit: PAGE_SIZE, offset: 0 },
    ),
  )
}

export function PoliciesPage() {
  const navigate = useNavigate()
  const i18n = useRegistryLegalI18nOrDefault()
  const m = useRegistryLegalMessagesOrDefault()
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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={m.policiesPage.columns.name} />
        ),
      },
      {
        accessorKey: "slug",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={m.policiesPage.columns.slug} />
        ),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.slug}</span>,
      },
      {
        accessorKey: "kind",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={m.policiesPage.columns.kind} />
        ),
        cell: ({ row }) => (
          <Badge variant="outline">
            {m.common.policyKindLabels[
              row.original.kind as keyof typeof m.common.policyKindLabels
            ] ?? row.original.kind}
          </Badge>
        ),
      },
      {
        accessorKey: "language",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={m.policiesPage.columns.language} />
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={m.policiesPage.columns.created} />
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
          <h1 className="text-2xl font-bold tracking-tight">{m.policiesPage.title}</h1>
          <p className="text-sm text-muted-foreground">{m.policiesPage.description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {m.policiesPage.create}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={m.policiesPage.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={kind} onValueChange={(v) => setKind(v ?? "all")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={m.policiesPage.columns.kind} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.policiesPage.allKinds}</SelectItem>
            {KINDS.map((item) => (
              <SelectItem key={item} value={item}>
                {m.common.policyKindLabels[item]}
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

      {data ? (
        <p className="text-sm text-muted-foreground">
          {formatMessage(m.policiesPage.summary, {
            shown: data.data.length,
            total: data.total,
          })}
        </p>
      ) : null}

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
