// Filterable list of runs rendered as a compact table. Drives the
// detail pane via `onSelectRun`. Search matches run id / workflow id
// / tags; status filter is a single-select pill.

import { Badge } from "@voyantjs/ui/components/badge"
import { Input } from "@voyantjs/ui/components/input"
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
import { cn } from "@voyantjs/ui/lib/utils"
import { Search, X } from "lucide-react"
import { useMemo, useState } from "react"

import { StatusBadge } from "@/components/status-badge"
import type { StoredRun } from "@/lib/api"
import { formatDuration, formatRelative } from "@/lib/utils"

const ALL_STATUSES = "__all__"
const ALL_WORKFLOWS = "__all__"

export function RunsTable({
  runs,
  selectedRunId,
  onSelectRun,
  workflowFilter,
  onClearWorkflowFilter,
}: {
  runs: StoredRun[]
  selectedRunId: string | undefined
  onSelectRun: (runId: string) => void
  /** External workflow filter (e.g. set when arriving from the Workflows page). */
  workflowFilter?: string
  onClearWorkflowFilter?: () => void
}): React.ReactElement {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES)
  const [workflowSelfFilter, setWorkflowSelfFilter] = useState<string>(ALL_WORKFLOWS)

  const statusItems = useMemo(() => {
    const set = new Set<string>()
    for (const r of runs) set.add(r.status)
    return [
      { value: ALL_STATUSES, label: "All statuses" },
      ...[...set].sort().map((s) => ({ value: s, label: prettyStatus(s) })),
    ]
  }, [runs])

  const workflowItems = useMemo(() => {
    const set = new Set<string>()
    for (const r of runs) set.add(r.workflowId)
    return [
      { value: ALL_WORKFLOWS, label: "All workflows" },
      ...[...set].sort().map((id) => ({ value: id, label: id })),
    ]
  }, [runs])

  // External prop wins when set; otherwise the in-table select drives.
  const effectiveWorkflow = workflowFilter ?? workflowSelfFilter

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return runs.filter((r) => {
      if (statusFilter !== ALL_STATUSES && r.status !== statusFilter) return false
      if (effectiveWorkflow !== ALL_WORKFLOWS && r.workflowId !== effectiveWorkflow) {
        return false
      }
      if (q.length === 0) return true
      return (
        r.id.toLowerCase().includes(q) ||
        r.workflowId.toLowerCase().includes(q) ||
        (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [runs, query, statusFilter, effectiveWorkflow])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="relative min-w-[11rem] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search runs…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select
          items={statusItems}
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? ALL_STATUSES)}
        >
          <SelectTrigger className="h-8 w-[140px] min-w-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {workflowFilter === undefined && (
          <Select
            items={workflowItems}
            value={workflowSelfFilter}
            onValueChange={(v) => setWorkflowSelfFilter(v ?? ALL_WORKFLOWS)}
          >
            <SelectTrigger className="h-8 w-[170px] min-w-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workflowItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  <span className="font-mono text-[11px]">{item.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {workflowFilter && (
        <div className="border-border flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5">
          <span className="text-muted-foreground text-[11px]">Filtered to</span>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {workflowFilter}
          </Badge>
          {onClearWorkflowFilter && (
            <button
              type="button"
              onClick={onClearWorkflowFilter}
              className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 text-[11px]"
              aria-label="Clear workflow filter"
            >
              <X className="size-3" />
              Clear
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <Table className={filtered.length === 0 ? "min-w-full" : "min-w-full sm:min-w-[620px]"}>
          <TableHeader className="bg-background/95 sticky top-0 z-10 backdrop-blur">
            <TableRow>
              <TableHead className="w-[110px] text-[11px] font-medium uppercase tracking-wide">
                Status
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wide">
                Workflow
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wide">Run</TableHead>
              <TableHead className="w-[90px] text-[11px] font-medium uppercase tracking-wide">
                Duration
              </TableHead>
              <TableHead className="w-[110px] text-[11px] font-medium uppercase tracking-wide">
                Started
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-12 text-center text-xs">
                  {runs.length === 0 ? (
                    <>
                      No runs yet. Trigger one with the{" "}
                      <kbd className="bg-muted rounded px-1">New run</kbd> button.
                    </>
                  ) : (
                    <>No runs match the current filters.</>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((run) => (
                <TableRow
                  key={run.id}
                  data-state={run.id === selectedRunId ? "selected" : undefined}
                  onClick={() => onSelectRun(run.id)}
                  className={cn("cursor-pointer", run.id === selectedRunId && "bg-muted/70")}
                >
                  <TableCell className="py-2">
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="py-2 font-mono text-xs">{run.workflowId}</TableCell>
                  <TableCell className="text-muted-foreground truncate py-2 font-mono text-[11px]">
                    {run.id}
                  </TableCell>
                  <TableCell className="text-muted-foreground py-2 font-mono text-xs tabular-nums">
                    {formatDuration(run.durationMs)}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground py-2 text-xs"
                    title={new Date(run.startedAt).toLocaleString()}
                  >
                    {formatRelative(run.startedAt - Date.now())}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function prettyStatus(status: string): string {
  const words = status.replace(/_/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
