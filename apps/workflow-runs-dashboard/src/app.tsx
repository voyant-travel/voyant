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
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Link2,
  Play,
  RefreshCw,
  RotateCw,
  Workflow,
  XCircle,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  getRun,
  type ListRunsQuery,
  listRuns,
  type RerunResumeError,
  rerunRun,
  resumeRun,
  type WorkflowRun,
  type WorkflowRunErrorPayload,
  type WorkflowRunStep,
} from "./api"

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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="space-y-3 md:w-80 md:shrink-0">
          <Filters filters={filters} onChange={setFilters} />
          {error ? (
            <Card className="border-destructive/40">
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
              <RunListItem
                key={run.id}
                run={run}
                selected={selectedId === run.id}
                onSelect={() => setSelectedId(run.id)}
              />
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {selectedId ? (
            <RunDetail runId={selectedId} onNavigate={setSelectedId} />
          ) : (
            <SelectPrompt />
          )}
        </section>
      </main>
    </div>
  )
}

function RunListItem({
  run,
  selected,
  onSelect,
}: {
  run: WorkflowRun
  selected: boolean
  onSelect: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border bg-card p-3 text-left text-sm transition-colors hover:bg-muted/50 ${
        selected ? "border-primary bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <StatusIcon status={run.status} />
        <span className="truncate font-medium">{run.workflowName}</span>
        <span className="ml-auto whitespace-nowrap text-muted-foreground text-xs">
          {formatRelative(run.startedAt)}
        </span>
      </div>
      {run.durationMs != null ? (
        <div className="mt-1 text-muted-foreground text-xs">{formatDuration(run.durationMs)}</div>
      ) : null}
      {run.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {run.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
          {run.tags.length > 3 ? (
            <span className="text-muted-foreground text-xs">+{run.tags.length - 3}</span>
          ) : null}
        </div>
      ) : null}
    </button>
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
        <Field label="Workflow">
          <Input
            placeholder="checkout-finalize"
            value={filters.workflowName ?? ""}
            onChange={(e) => onChange({ ...filters, workflowName: e.target.value || undefined })}
          />
        </Field>
        <Field label="Status">
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
        </Field>
        <Field label="Tag">
          <Input
            placeholder="bookingId:bk_…"
            value={filters.tag ?? ""}
            onChange={(e) => onChange({ ...filters, tag: e.target.value || undefined })}
          />
        </Field>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
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

function RunDetail({
  runId,
  onNavigate,
}: {
  runId: string
  onNavigate: (id: string) => void
}): React.ReactElement {
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [steps, setSteps] = useState<WorkflowRunStep[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reruns, setReruns] = useState<WorkflowRun[]>([])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const [detail, children] = await Promise.all([
          getRun(runId),
          listRuns({ parentRunId: runId, limit: 20 }).catch(() => ({ data: [] })),
        ])
        if (cancelled) return
        setRun(detail.data.run)
        setSteps(detail.data.steps)
        setReruns((children as { data: WorkflowRun[] }).data)
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

  // The run-level error is usually the same payload as one of the
  // step errors (the workflow rethrows the failing step). When the
  // messages match, we suppress the trailing "Run error" block to
  // avoid showing the same wall of text twice.
  const runErrorMatchesStepError = useMemo(() => {
    if (!run?.error) return false
    return steps.some((step) => step.error && (step.error.message === run.error?.message || false))
  }, [run?.error, steps])

  if (error) {
    return (
      <Card className="border-destructive/40">
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
      <RunHeaderCard run={run} onNavigate={onNavigate} />
      <RunActionsCard run={run} onNavigate={onNavigate} />
      {reruns.length > 0 ? <RerunsListCard reruns={reruns} onNavigate={onNavigate} /> : null}
      <StepsCard steps={steps} />
      {run.input ? <PayloadCard title="Input" value={run.input} /> : null}
      {run.result ? <PayloadCard title="Result" value={run.result} /> : null}
      {run.error && !runErrorMatchesStepError ? (
        <ErrorCard title="Run error" error={run.error} />
      ) : null}
    </div>
  )
}

function RunActionsCard({
  run,
  onNavigate,
}: {
  run: WorkflowRun
  onNavigate: (id: string) => void
}): React.ReactElement {
  const [busy, setBusy] = useState<"rerun" | "resume" | null>(null)
  const [feedback, setFeedback] = useState<{ kind: "info" | "error"; message: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const explainError = useCallback((err: RerunResumeError): string => {
    if (err.error === "runner_not_registered") {
      return "No runner registered for this workflow. The bundle that owns it must register a WorkflowRunner on bootstrap before rerun is available."
    }
    if (err.error === "rerun_blocked") {
      return err.detail ?? "Rerun was blocked by the runner's safety predicate."
    }
    if (err.error === "incomplete_prior_step") {
      return err.detail ?? "Cannot resume — a step before the failure is not in a completed state."
    }
    return err.detail ?? err.error ?? "Action failed."
  }, [])

  const doRerun = async (confirm: boolean): Promise<void> => {
    setBusy("rerun")
    setFeedback(null)
    try {
      const result = await rerunRun(run.id, { confirm })
      if (result.ok) {
        setFeedback({ kind: "info", message: `Rerun started — opening new run.` })
        onNavigate(result.data.runId)
        setConfirmOpen(false)
      } else if (result.error.error === "confirmation_required") {
        // Server demands confirm: open the dialog.
        setConfirmOpen(true)
      } else {
        setFeedback({ kind: "error", message: explainError(result.error) })
      }
    } finally {
      setBusy(null)
    }
  }

  const doResume = async (): Promise<void> => {
    setBusy("resume")
    setFeedback(null)
    try {
      const result = await resumeRun(run.id)
      if (result.ok) {
        setFeedback({
          kind: "info",
          message: `Resumed from step "${result.data.resumeFromStep ?? ""}" — opening new run.`,
        })
        onNavigate(result.data.runId)
      } else {
        setFeedback({ kind: "error", message: explainError(result.error) })
      }
    } finally {
      setBusy(null)
    }
  }

  // Resume is only meaningful for failed runs.
  const canResume = run.status === "failed"
  const isRunning = run.status === "running"

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 pt-4">
        <Button
          variant="default"
          size="sm"
          onClick={() => void doRerun(false)}
          disabled={busy !== null || isRunning}
          title={
            isRunning
              ? "Wait for this run to finish before rerunning."
              : "Start a new run with the same recorded input."
          }
        >
          <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${busy === "rerun" ? "animate-spin" : ""}`} />
          Rerun
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void doResume()}
          disabled={busy !== null || !canResume}
          title={
            canResume
              ? "Skip already-completed steps and retry from the failed step."
              : "Resume is only available for failed runs."
          }
        >
          <Play className={`mr-1.5 h-3.5 w-3.5 ${busy === "resume" ? "animate-pulse" : ""}`} />
          Resume from failed step
        </Button>
        {feedback ? (
          <span
            className={`ml-auto text-xs ${
              feedback.kind === "error" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {feedback.message}
          </span>
        ) : null}
      </CardContent>
      {confirmOpen ? (
        <ConfirmRerunDialog
          run={run}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void doRerun(true)}
          busy={busy === "rerun"}
        />
      ) : null}
    </Card>
  )
}

function ConfirmRerunDialog({
  run,
  onCancel,
  onConfirm,
  busy,
}: {
  run: WorkflowRun
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
}): React.ReactElement {
  // The server is the source of truth on whether confirm is required;
  // by the time this dialog renders, we know the runner declared
  // itself "unsafe". Be explicit about what the user is consenting to.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md border-amber-500/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Confirm rerun
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="font-mono text-xs">{run.workflowName}</span> has side effects that
            re-fire on rerun (e.g. issuing a new invoice). The new run will start from the first
            step with the same recorded input.
          </p>
          <p className="text-muted-foreground text-xs">
            Tip: if the original failed mid-way, prefer{" "}
            <span className="font-medium">Resume from failed step</span> instead — it skips
            already-completed work.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={onConfirm} disabled={busy}>
              <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
              Rerun anyway
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function RerunsListCard({
  reruns,
  onNavigate,
}: {
  reruns: WorkflowRun[]
  onNavigate: (id: string) => void
}): React.ReactElement {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          Reruns of this run
          <span className="font-normal text-muted-foreground text-xs">({reruns.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {reruns.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onNavigate(r.id)}
                className="flex w-full items-center gap-2 rounded p-2 text-left text-sm hover:bg-muted/40"
              >
                <StatusIcon status={r.status} />
                <span className="font-mono text-xs">{r.id}</span>
                <span className="text-muted-foreground text-xs">{r.trigger}</span>
                {r.resumeFromStep ? (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    resume @ {r.resumeFromStep}
                  </Badge>
                ) : null}
                <span className="ml-auto whitespace-nowrap text-muted-foreground text-xs">
                  {formatRelative(r.startedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function RunHeaderCard({
  run,
  onNavigate,
}: {
  run: WorkflowRun
  onNavigate: (id: string) => void
}): React.ReactElement {
  return (
    <Card>
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusIcon status={run.status} />
          <CardTitle className="font-semibold text-lg">{run.workflowName}</CardTitle>
          <StatusBadge status={run.status} />
          {run.durationMs != null ? (
            <Badge variant="outline" className="font-mono text-xs">
              {formatDuration(run.durationMs)}
            </Badge>
          ) : null}
          {run.resumeFromStep ? (
            <Badge variant="outline" className="font-mono text-xs">
              resumed @ {run.resumeFromStep}
            </Badge>
          ) : null}
          <CopyableId id={run.id} className="ml-auto" />
        </div>
        <div className="text-muted-foreground text-sm">
          <span>Started {new Date(run.startedAt).toLocaleString()}</span>
          {run.completedAt ? (
            <span>
              {" · "}Finished {new Date(run.completedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <DefRow label="Trigger" value={run.trigger} mono />
          {run.correlationId ? <DefRow label="Correlation" value={run.correlationId} mono /> : null}
          {run.parentRunId ? (
            <div className="flex items-baseline gap-2">
              <dt className="shrink-0 text-muted-foreground text-xs uppercase tracking-wide">
                Parent
              </dt>
              <dd className="min-w-0 truncate">
                <button
                  type="button"
                  onClick={() => run.parentRunId && onNavigate(run.parentRunId)}
                  className="inline-flex items-center gap-1.5 truncate font-mono text-xs hover:underline"
                  title={run.parentRunId}
                >
                  <Link2 className="h-3 w-3 opacity-60" />
                  {run.parentRunId}
                </button>
              </dd>
            </div>
          ) : null}
          {run.triggeredByUserId ? (
            <DefRow label="Triggered by" value={run.triggeredByUserId} mono />
          ) : null}
        </dl>
        {run.tags.length > 0 ? (
          <div>
            <div className="mb-1.5 text-muted-foreground text-xs uppercase tracking-wide">Tags</div>
            <div className="flex flex-wrap gap-1">
              {run.tags.map((t) => (
                <TagChip key={t} tag={t} />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function StepsCard({ steps }: { steps: WorkflowRunStep[] }): React.ReactElement {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Steps</CardTitle>
      </CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <p className="text-muted-foreground text-sm">No steps recorded.</p>
        ) : (
          <ol className="space-y-2">
            {steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function StepRow({ step }: { step: WorkflowRunStep }): React.ReactElement {
  // Step rows default to expanded for failed steps (operator wants to
  // see the error immediately) and collapsed for everything else
  // (output is rarely interesting; saves vertical space).
  const [open, setOpen] = useState(step.status === "failed")
  const hasDetail = step.output !== null || step.error !== null

  return (
    <li className="rounded-md border">
      <button
        type="button"
        className="flex w-full items-center gap-2 p-3 text-left text-sm hover:bg-muted/30"
        onClick={() => hasDetail && setOpen((prev) => !prev)}
        disabled={!hasDetail}
      >
        <StepStatusIcon status={step.status} />
        <span className="font-medium">
          {step.sequence}. {step.stepName}
        </span>
        {step.error ? (
          <span className="truncate text-destructive text-xs">{step.error.message}</span>
        ) : null}
        <span className="ml-auto whitespace-nowrap text-muted-foreground text-xs">
          {step.durationMs != null ? formatDuration(step.durationMs) : "—"}
        </span>
        {hasDetail ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )
        ) : null}
      </button>
      {open && hasDetail ? (
        <div className="space-y-3 border-t p-3">
          {step.error ? <ErrorBlock error={step.error} /> : null}
          {step.output ? <PayloadBlock title="Output" value={step.output} /> : null}
        </div>
      ) : null}
    </li>
  )
}

function ErrorCard({
  title,
  error,
}: {
  title: string
  error: WorkflowRunErrorPayload
}): React.ReactElement {
  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-destructive text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ErrorBlock error={error} />
      </CardContent>
    </Card>
  )
}

function ErrorBlock({ error }: { error: WorkflowRunErrorPayload }): React.ReactElement {
  return (
    <div className="space-y-2">
      <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <div className="font-medium text-destructive">{error.message}</div>
        {error.code || error.stepName ? (
          <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground text-xs">
            {error.code ? (
              <span>
                <span className="text-muted-foreground/70">code </span>
                <span className="font-mono">{error.code}</span>
              </span>
            ) : null}
            {error.stepName ? (
              <span>
                <span className="text-muted-foreground/70">step </span>
                <span className="font-mono">{error.stepName}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {error.stack ? <CollapsibleStack stack={error.stack} /> : null}
    </div>
  )
}

function CollapsibleStack({ stack }: { stack: string }): React.ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded border bg-muted/30"
    >
      <summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-muted-foreground text-xs hover:text-foreground">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Stack trace
      </summary>
      <pre className="overflow-x-auto whitespace-pre p-3 pt-0 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {stack}
      </pre>
    </details>
  )
}

function PayloadCard({
  title,
  value,
}: {
  title: string
  value: Record<string, unknown>
}): React.ReactElement {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <PayloadBlock title={title} value={value} hideTitle />
      </CardContent>
    </Card>
  )
}

function PayloadBlock({
  title,
  value,
  hideTitle = false,
}: {
  title: string
  value: Record<string, unknown>
  hideTitle?: boolean
}): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const json = useMemo(() => JSON.stringify(value, null, 2), [value])

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — silent */
    }
  }

  return (
    <div className="space-y-1">
      {hideTitle ? null : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">{title}</span>
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <pre className="max-h-[24rem] overflow-auto rounded bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
        {json}
      </pre>
    </div>
  )
}

function DefRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}): React.ReactElement {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className={mono ? "min-w-0 truncate font-mono text-xs" : "min-w-0 truncate text-sm"}>
        {value}
      </dd>
    </div>
  )
}

function CopyableId({ id, className }: { id: string; className?: string }): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* silent */
    }
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      className={`group inline-flex items-center gap-1.5 rounded border bg-muted/40 px-2 py-1 font-mono text-[11px] hover:bg-muted ${
        className ?? ""
      }`}
      title={id}
    >
      <span className="max-w-[16ch] truncate">{id}</span>
      <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
      {copied ? <span className="text-emerald-500 text-[10px]">copied</span> : null}
    </button>
  )
}

function TagChip({ tag }: { tag: string }): React.ReactElement {
  // Split `key:value` so the key is dimmed and the value is the
  // visual focus — the chip would otherwise be a solid mono blob.
  const colonIdx = tag.indexOf(":")
  if (colonIdx < 0) {
    return (
      <Badge variant="outline" className="font-mono text-[10px]">
        {tag}
      </Badge>
    )
  }
  const key = tag.slice(0, colonIdx)
  const value = tag.slice(colonIdx + 1)
  return (
    <Badge variant="outline" className="gap-1 font-mono text-[10px]" title={tag}>
      <span className="text-muted-foreground">{key}</span>
      <span className="max-w-[18ch] truncate">{value}</span>
    </Badge>
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

function StatusBadge({ status }: { status: WorkflowRun["status"] }): React.ReactElement {
  const className = {
    succeeded: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    failed: "border-destructive/40 bg-destructive/10 text-destructive",
    cancelled: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    running: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  }[status]
  return (
    <Badge variant="outline" className={`text-[11px] ${className}`}>
      {status}
    </Badge>
  )
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

/**
 * Format milliseconds as a human-readable duration. Steps + workflows
 * usually finish in seconds; show ms for sub-second runs and a
 * minutes-and-seconds breakdown for long ones.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}
