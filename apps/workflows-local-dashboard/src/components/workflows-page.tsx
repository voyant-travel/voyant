// Workflows list view. One row per workflow registered by the loaded
// entry file. Stats are computed from the live runs map — total runs,
// running right now, last-run status + time, average duration of
// completed runs. Clicking a row jumps to the Runs view filtered to
// that workflow id.

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { cn } from "@voyantjs/ui/lib/utils"
import { Workflow } from "lucide-react"
import { useMemo } from "react"

import { StatusBadge } from "@/components/status-badge"
import type { StoredRun, WorkflowSummary } from "@/lib/api"
import { formatDuration, formatRelative } from "@/lib/utils"

interface WorkflowStats {
  total: number
  running: number
  lastRun?: StoredRun
  avgDurationMs?: number
}

function computeStats(runs: readonly StoredRun[]): Map<string, WorkflowStats> {
  const byId = new Map<string, StoredRun[]>()
  for (const r of runs) {
    const bucket = byId.get(r.workflowId)
    if (bucket) bucket.push(r)
    else byId.set(r.workflowId, [r])
  }
  const stats = new Map<string, WorkflowStats>()
  for (const [id, bucket] of byId) {
    bucket.sort((a, b) => b.startedAt - a.startedAt)
    const running = bucket.filter((r) => r.status === "running").length
    const completedWithDuration = bucket.filter(
      (r) => r.status === "completed" && typeof r.durationMs === "number",
    )
    const avg =
      completedWithDuration.length > 0
        ? completedWithDuration.reduce((s, r) => s + (r.durationMs ?? 0), 0) /
          completedWithDuration.length
        : undefined
    stats.set(id, {
      total: bucket.length,
      running,
      lastRun: bucket[0],
      avgDurationMs: avg,
    })
  }
  return stats
}

export function WorkflowsPage({
  workflows,
  runs,
  onOpenRuns,
  onNewRun,
}: {
  workflows: readonly WorkflowSummary[]
  runs: readonly StoredRun[]
  onOpenRuns: (workflowId: string) => void
  onNewRun: () => void
}): React.ReactElement {
  const stats = useMemo(() => computeStats(runs), [runs])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-border flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <Workflow className="size-4" />
        <h1 className="text-sm font-medium">Workflows</h1>
        <span className="text-muted-foreground text-xs">{workflows.length} registered</span>
      </header>

      <div className="flex-1 overflow-auto">
        {workflows.length === 0 ? (
          <EmptyState />
        ) : (
          <Table>
            <TableHeader className="bg-background/95 sticky top-0 z-10 backdrop-blur">
              <TableRow>
                <TableHead className="text-[11px] font-medium uppercase tracking-wide">
                  Workflow
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wide">
                  Description
                </TableHead>
                <TableHead className="w-[90px] text-[11px] font-medium uppercase tracking-wide">
                  Runs
                </TableHead>
                <TableHead className="w-[90px] text-[11px] font-medium uppercase tracking-wide">
                  Running
                </TableHead>
                <TableHead className="w-[140px] text-[11px] font-medium uppercase tracking-wide">
                  Last run
                </TableHead>
                <TableHead className="w-[120px] text-[11px] font-medium uppercase tracking-wide">
                  Avg duration
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((wf) => {
                const s = stats.get(wf.id)
                return (
                  <TableRow
                    key={wf.id}
                    className={cn("cursor-pointer")}
                    onClick={() => onOpenRuns(wf.id)}
                  >
                    <TableCell className="py-2 font-mono text-xs">{wf.id}</TableCell>
                    <TableCell className="text-muted-foreground py-2 text-xs">
                      {wf.description ?? "—"}
                    </TableCell>
                    <TableCell className="py-2 font-mono text-xs tabular-nums">
                      {s?.total ?? 0}
                    </TableCell>
                    <TableCell className="py-2">
                      {s && s.running > 0 ? (
                        <span className="font-mono text-xs text-sky-500 tabular-nums">
                          {s.running}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      {s?.lastRun ? (
                        <div className="flex items-center gap-2">
                          <StatusBadge status={s.lastRun.status} />
                          <span
                            className="text-muted-foreground text-[11px]"
                            title={new Date(s.lastRun.startedAt).toLocaleString()}
                          >
                            {formatRelative(s.lastRun.startedAt - Date.now())}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground py-2 font-mono text-xs tabular-nums">
                      {s?.avgDurationMs !== undefined ? formatDuration(s.avgDurationMs) : "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {workflows.length > 0 && (
        <footer className="border-border text-muted-foreground border-t px-4 py-2 text-[11px]">
          Click a row to view its runs. Press <kbd className="bg-muted rounded px-1">N</kbd> to
          trigger a new run.
          <button
            type="button"
            onClick={onNewRun}
            className="text-foreground ml-2 underline underline-offset-2 hover:opacity-80"
          >
            Trigger
          </button>
        </footer>
      )}
    </div>
  )
}

function EmptyState(): React.ReactElement {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm">
      <Workflow className="size-8" />
      <div>No workflows registered.</div>
      <div className="text-xs">
        Start <code className="font-mono">voyant dev --file ./src/workflows.ts</code> with a file
        that calls <code className="font-mono">workflow(...)</code>.
      </div>
    </div>
  )
}
