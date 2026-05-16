"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { ActionLedgerEntryResponse, ActionLedgerListResponse } from "@voyantjs/action-ledger"
import { useLocale } from "@voyantjs/admin"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { ExternalLink, Eye, RefreshCw, ScrollText, Search, X } from "lucide-react"
import { type FormEvent, type ReactNode, useMemo, useState } from "react"

import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import { ActionLedgerEntrySheet } from "./action-ledger-entry-sheet"

type LedgerBadgeVariant = "default" | "secondary" | "outline" | "destructive"
type ActionLedgerCursor = NonNullable<ActionLedgerListResponse["pageInfo"]["nextCursor"]>
type ActionLedgerFilters = {
  actionName: string
  principalId: string
  targetType: string
  targetId: string
  workflowRunId: string
  correlationId: string
  evaluatedRisk: string
  status: string
}

const EMPTY_FILTERS: ActionLedgerFilters = {
  actionName: "",
  principalId: "",
  targetType: "",
  targetId: "",
  workflowRunId: "",
  correlationId: "",
  evaluatedRisk: "all",
  status: "all",
}

const STATUS_VARIANT: Partial<Record<ActionLedgerEntryResponse["status"], LedgerBadgeVariant>> = {
  succeeded: "default",
  approved: "default",
  awaiting_approval: "secondary",
  requested: "secondary",
  denied: "destructive",
  failed: "destructive",
  expired: "destructive",
  cancelled: "destructive",
  superseded: "outline",
  reversed: "outline",
  compensated: "outline",
}

const RISK_VARIANT: Partial<
  Record<ActionLedgerEntryResponse["evaluatedRisk"], LedgerBadgeVariant>
> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  critical: "destructive",
}

export function ActionLedgerPage() {
  const { resolvedLocale } = useLocale()
  const [draftFilters, setDraftFilters] = useState<ActionLedgerFilters>(EMPTY_FILTERS)
  const [filters, setFilters] = useState<ActionLedgerFilters>(EMPTY_FILTERS)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const filterCacheKey = useMemo(() => getActionLedgerFilterCacheKey(filters), [filters])

  const ledgerQuery = useInfiniteQuery({
    queryKey: queryKeys.actionLedger.entries(filterCacheKey),
    queryFn: ({ pageParam }) => getActionLedgerEntries(filters, pageParam),
    initialPageParam: null as ActionLedgerCursor | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor,
  })

  const entries = ledgerQuery.data?.pages.flatMap((page) => page.data) ?? []
  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) => {
        if (!value) return false
        if ((key === "evaluatedRisk" || key === "status") && value === "all") return false
        return true
      }).length,
    [filters],
  )

  function updateDraftFilter<K extends keyof ActionLedgerFilters>(
    key: K,
    value: ActionLedgerFilters[K],
  ) {
    setDraftFilters((current) => ({ ...current, [key]: value }))
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters(normalizeFilters(draftFilters))
  }

  function resetFilters() {
    setDraftFilters(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Action ledger</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Search central action records by actor, target, workflow, risk, and status.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={ledgerQuery.isFetching}
          onClick={() => void ledgerQuery.refetch()}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-muted-foreground" />
            Filters
            {activeFilterCount > 0 ? (
              <Badge variant="outline" className="text-[10px]">
                {activeFilterCount}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={applyFilters}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FilterField label="Action">
                <Input
                  value={draftFilters.actionName}
                  placeholder="booking.pii.read"
                  onChange={(event) => updateDraftFilter("actionName", event.target.value)}
                />
              </FilterField>
              <FilterField label="Principal ID">
                <Input
                  value={draftFilters.principalId}
                  placeholder="user or agent id"
                  onChange={(event) => updateDraftFilter("principalId", event.target.value)}
                />
              </FilterField>
              <FilterField label="Target type">
                <Input
                  value={draftFilters.targetType}
                  placeholder="booking"
                  onChange={(event) => updateDraftFilter("targetType", event.target.value)}
                />
              </FilterField>
              <FilterField label="Target ID">
                <Input
                  value={draftFilters.targetId}
                  placeholder="target id"
                  onChange={(event) => updateDraftFilter("targetId", event.target.value)}
                />
              </FilterField>
              <FilterField label="Workflow run">
                <Input
                  value={draftFilters.workflowRunId}
                  placeholder="workflow run id"
                  onChange={(event) => updateDraftFilter("workflowRunId", event.target.value)}
                />
              </FilterField>
              <FilterField label="Correlation">
                <Input
                  value={draftFilters.correlationId}
                  placeholder="correlation id"
                  onChange={(event) => updateDraftFilter("correlationId", event.target.value)}
                />
              </FilterField>
              <FilterField label="Risk">
                <Select
                  value={draftFilters.evaluatedRisk}
                  onValueChange={(value) => updateDraftFilter("evaluatedRisk", value ?? "all")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any risk</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Status">
                <Select
                  value={draftFilters.status}
                  onValueChange={(value) => updateDraftFilter("status", value ?? "all")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any status</SelectItem>
                    <SelectItem value="requested">Requested</SelectItem>
                    <SelectItem value="awaiting_approval">Awaiting approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                    <SelectItem value="succeeded">Succeeded</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="reversed">Reversed</SelectItem>
                    <SelectItem value="compensated">Compensated</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="superseded">Superseded</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={resetFilters}>
                <X className="h-4 w-4" />
                Clear
              </Button>
              <Button type="submit">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            Entries
            {entries.length > 0 ? (
              <Badge variant="outline" className="text-[10px]">
                {entries.length}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ledgerQuery.isLoading ? (
            <p className="px-6 py-6 text-center text-muted-foreground text-sm">
              Loading action ledger...
            </p>
          ) : entries.length === 0 ? (
            <p className="px-6 py-6 text-center text-muted-foreground text-sm">
              No action ledger entries match these filters.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <LedgerRow
                        key={entry.id}
                        entry={entry}
                        locale={resolvedLocale}
                        onSelect={setSelectedEntryId}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              {ledgerQuery.hasNextPage ? (
                <div className="border-t px-4 py-3 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={ledgerQuery.isFetchingNextPage}
                    onClick={() => void ledgerQuery.fetchNextPage()}
                  >
                    {ledgerQuery.isFetchingNextPage ? "Loading..." : "Load more"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
      <ActionLedgerEntrySheet
        open={Boolean(selectedEntryId)}
        onOpenChange={(open) => {
          if (!open) setSelectedEntryId(null)
        }}
        entryId={selectedEntryId}
        locale={resolvedLocale}
      />
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  )
}

function LedgerRow({
  entry,
  locale,
  onSelect,
}: {
  entry: ActionLedgerEntryResponse
  locale: string
  onSelect: (id: string) => void
}) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
        {formatDateTime(entry.occurredAt, locale)}
      </TableCell>
      <TableCell>
        <div className="font-medium">{formatActionName(entry.actionName)}</div>
        <div className="mt-0.5 max-w-[16rem] truncate text-muted-foreground text-xs">
          {entry.routeOrToolName ?? entry.id}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{entry.principalType}</div>
        <div className="mt-0.5 max-w-[13rem] truncate font-mono text-muted-foreground text-xs">
          {entry.principalId}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{formatTargetType(entry.targetType)}</div>
        <div className="mt-0.5 max-w-[14rem] truncate font-mono text-muted-foreground text-xs">
          {entry.targetType === "booking" ? (
            <Link
              to="/bookings/$id"
              params={{ id: entry.targetId }}
              className="inline-flex items-center text-primary underline-offset-4 hover:underline"
            >
              {entry.targetId}
              <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          ) : (
            entry.targetId
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-[12rem] truncate font-mono text-muted-foreground text-xs">
          {entry.workflowRunId ?? entry.correlationId ?? "-"}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={RISK_VARIANT[entry.evaluatedRisk] ?? "outline"}>
          {entry.evaluatedRisk}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[entry.status] ?? "outline"}>{entry.status}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`View ${entry.id}`}
          onClick={() => onSelect(entry.id)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

async function getActionLedgerEntries(
  filters: ActionLedgerFilters,
  cursor: ActionLedgerCursor | null,
): Promise<ActionLedgerListResponse> {
  const search = new URLSearchParams({ limit: "50" })

  for (const [key, value] of Object.entries(filters)) {
    if (!value || value === "all") continue
    search.set(key, value)
  }

  if (cursor) {
    search.set("cursorOccurredAt", cursor.occurredAt)
    search.set("cursorId", cursor.id)
  }

  return api.get<ActionLedgerListResponse>(`/v1/admin/action-ledger/entries?${search}`)
}

function getActionLedgerFilterCacheKey(filters: ActionLedgerFilters) {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (!value || value === "all") continue
    search.set(key, value)
  }

  return search.toString()
}

function normalizeFilters(filters: ActionLedgerFilters): ActionLedgerFilters {
  return {
    actionName: filters.actionName.trim(),
    principalId: filters.principalId.trim(),
    targetType: filters.targetType.trim(),
    targetId: filters.targetId.trim(),
    workflowRunId: filters.workflowRunId.trim(),
    correlationId: filters.correlationId.trim(),
    evaluatedRisk: filters.evaluatedRisk,
    status: filters.status,
  }
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatActionName(value: string) {
  return value.replaceAll(".", " / ").replaceAll("_", " ")
}

function formatTargetType(value: string) {
  return value.replaceAll("_", " ")
}
