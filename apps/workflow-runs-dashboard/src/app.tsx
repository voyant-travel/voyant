import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Input } from "@voyantjs/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Workflow, XCircle } from "lucide-react"
import { useEffect, useState } from "react"

import { getRun, type ListRunsQuery, listRuns, type WorkflowRun, type WorkflowRunStep } from "./api"

/**
 * Single-page UI for the workflow_runs admin surface.
 *
 * Layout: a left rail listing recent runs + filters, a right panel
 * with the selected run's detail (steps, input, result, error). The
 * page polls the list every 5s so users see new runs land while
 * they have the dashboard open — no SSE / websockets needed since
 * runs are short-lived.
 */
export function App(): React.ReactElement {
  const [filters, setFilters] = useState<ListRunsQuery>({ limit: 50 })
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      setLoading(true)
      try {
        const res = await listRuns(filters)
        if (!cancelled) {
          setRuns(res.data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void refresh()
    const interval = setInterval(() => void refresh(), 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [filters])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card/40 backdrop-blur">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3">
          <Workflow className="h-5 w-5" />
          <h1 className="font-semibold text-base">Workflow runs</h1>
          <span className="text-muted-foreground text-xs">
            {runs.length} {runs.length === 1 ? "run" : "runs"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setFilters({ ...filters })}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="md:w-96 md:shrink-0 md:max-w-[24rem] space-y-3">
          <Filters filters={filters} onChange={setFilters} />
          {error ? (
            <Card>
              <CardContent className="pt-4 text-destructive text-sm">{error}</CardContent>
            </Card>
          ) : null}
          <div className="space-y-2">
            {runs.length === 0 && !loading ? (
              <Card>
                <CardContent className="pt-4 text-muted-foreground text-sm">
                  No runs yet. Trigger a checkout to see a row here.
                </CardContent>
              </Card>
            ) : null}
            {runs.map((run) => (
              <button
                type="button"
                key={run.id}
                onClick={() => setSelectedId(run.id)}
                className={`w-full rounded-md border bg-card p-3 text-left text-sm transition-colors hover:bg-muted/50 ${
                  selectedId === run.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <StatusIcon status={run.status} />
                  <span className="font-medium">{run.workflowName}</span>
                  <span className="ml-auto text-muted-foreground text-xs">
                    {formatRelative(run.startedAt)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-muted-foreground text-xs">
                  {run.tags.slice(0, 4).map((tag) => (
                    <Badge key={tag} variant="outline" className="font-mono">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex-1">
          {selectedId ? <RunDetail runId={selectedId} /> : <SelectPrompt />}
        </section>
      </main>
    </div>
  )
}

function Filters({
  filters,
  onChange,
}: {
  filters: ListRunsQuery
  onChange: (next: ListRunsQuery) => void
}): React.ReactElement {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Filter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs">Workflow</span>
          <Input
            placeholder="checkout-finalize"
            value={filters.workflowName ?? ""}
            onChange={(e) => onChange({ ...filters, workflowName: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs">Status</span>
          <Select
            value={filters.status ?? "any"}
            onValueChange={(v) =>
              onChange({
                ...filters,
                status: v === "any" ? undefined : (v as WorkflowRun["status"]),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs">Tag</span>
          <Input
            placeholder="bookingId:bk_…"
            value={filters.tag ?? ""}
            onChange={(e) => onChange({ ...filters, tag: e.target.value || undefined })}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function SelectPrompt(): React.ReactElement {
  return (
    <Card>
      <CardContent className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center text-muted-foreground text-sm">
        <Workflow className="h-6 w-6 opacity-60" />
        Pick a run from the list to see its steps and payloads.
      </CardContent>
    </Card>
  )
}

function RunDetail({ runId }: { runId: string }): React.ReactElement {
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [steps, setSteps] = useState<WorkflowRunStep[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const res = await getRun(runId)
        if (cancelled) return
        setRun(res.data.run)
        setSteps(res.data.steps)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void refresh()
    const interval = setInterval(refresh, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [runId])

  if (error) {
    return (
      <Card>
        <CardContent className="pt-4 text-destructive text-sm">{error}</CardContent>
      </Card>
    )
  }
  if (!run) {
    return (
      <Card>
        <CardContent className="pt-4 text-muted-foreground text-sm">Loading…</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusIcon status={run.status} />
            {run.workflowName}
            <Badge variant="outline" className="ml-auto font-mono text-xs">
              {run.id}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Status" value={run.status} />
          <Row label="Trigger" value={run.trigger} />
          {run.correlationId ? <Row label="Correlation" value={run.correlationId} /> : null}
          <Row label="Started" value={new Date(run.startedAt).toLocaleString()} />
          {run.completedAt ? (
            <Row label="Completed" value={new Date(run.completedAt).toLocaleString()} />
          ) : null}
          {run.durationMs != null ? <Row label="Duration" value={`${run.durationMs}ms`} /> : null}
          <div className="space-y-1 pt-2">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">Tags</span>
            <div className="flex flex-wrap gap-1">
              {run.tags.length === 0 ? (
                <span className="text-muted-foreground text-xs">—</span>
              ) : (
                run.tags.map((t) => (
                  <Badge key={t} variant="outline" className="font-mono">
                    {t}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Steps</CardTitle>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <p className="text-muted-foreground text-sm">No steps recorded.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {steps.map((step) => (
                <li key={step.id} className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <StepStatusIcon status={step.status} />
                    <span className="font-medium">
                      {step.sequence}. {step.stepName}
                    </span>
                    <span className="ml-auto text-muted-foreground text-xs">
                      {step.durationMs != null ? `${step.durationMs}ms` : "—"}
                    </span>
                  </div>
                  {step.output ? <CodeBlock label="Output" value={step.output} /> : null}
                  {step.error ? <CodeBlock label="Error" value={step.error} /> : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {run.input ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Input</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock value={run.input} />
          </CardContent>
        </Card>
      ) : null}

      {run.result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Result</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock value={run.result} />
          </CardContent>
        </Card>
      ) : null}

      {run.error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock value={run.error} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  )
}

function CodeBlock({ value, label }: { value: unknown; label?: string }): React.ReactElement {
  return (
    <div className="space-y-1">
      {label ? <div className="text-muted-foreground text-xs">{label}</div> : null}
      <pre className="overflow-x-auto rounded bg-muted/40 p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function StatusIcon({ status }: { status: WorkflowRun["status"] }): React.ReactElement {
  switch (status) {
    case "succeeded":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />
    case "cancelled":
      return <AlertCircle className="h-4 w-4 text-amber-500" />
    case "running":
      return <Clock className="h-4 w-4 animate-pulse text-blue-500" />
  }
}

function StepStatusIcon({ status }: { status: WorkflowRunStep["status"] }): React.ReactElement {
  switch (status) {
    case "succeeded":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />
    case "running":
      return <Clock className="h-4 w-4 animate-pulse text-blue-500" />
    case "skipped":
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />
    case "compensated":
      return <RefreshCw className="h-4 w-4 text-amber-500" />
  }
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString()
}
