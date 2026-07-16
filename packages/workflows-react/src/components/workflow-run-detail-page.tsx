"use client"

import { Badge } from "@voyant-travel/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@voyant-travel/ui/components/card"
import { ChevronDown, ChevronRight, Link2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  useWorkflowRunsUiI18nOrDefault,
  useWorkflowRunsUiMessagesOrDefault,
} from "../i18n/index.js"
import type {
  WorkflowRun,
  WorkflowRunErrorPayload,
  WorkflowRunStep,
  WorkflowRunsApi,
} from "../types.js"
import {
  CopyableId,
  formatDuration,
  formatRelative,
  PayloadBlock,
  StatusBadge,
  StatusIcon,
  StepStatusIcon,
  TagChip,
} from "./common.js"
import { WorkflowRunActionsCard } from "./workflow-run-actions.js"

export interface WorkflowRunDetailPageProps {
  api: WorkflowRunsApi
  runId: string
  onOpenRun?: (id: string) => void
  pollIntervalMs?: number
  className?: string
}

export function WorkflowRunDetailPage({
  api,
  runId,
  onOpenRun,
  pollIntervalMs = 3000,
  className,
}: WorkflowRunDetailPageProps) {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [steps, setSteps] = useState<WorkflowRunStep[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reruns, setReruns] = useState<WorkflowRun[]>([])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const [detail, children] = await Promise.all([
          api.getRun(runId),
          api.listRuns({ parentRunId: runId, limit: 20 }).catch(() => ({ data: [] })),
        ])
        if (cancelled) return
        setRun(detail.data.run)
        setSteps(detail.data.steps)
        setReruns(children.data)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void refresh()
    const interval = setInterval(() => void refresh(), pollIntervalMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [api, pollIntervalMs, runId])

  const duplicateRunError = useMemo(() => {
    if (!run?.error) return false
    return steps.some((step) => step.error?.message === run.error?.message)
  }, [run?.error, steps])

  if (error) return <ErrorMessage message={error} />
  if (!run) {
    return (
      <Card className={className}>
        <CardContent className="pt-4 text-muted-foreground text-sm">
          {messages.page.loading}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <RunHeaderCard run={run} onOpenRun={onOpenRun} />
      <WorkflowRunActionsCard api={api} run={run} onOpenRun={onOpenRun} />
      {reruns.length > 0 ? <RerunsListCard reruns={reruns} onOpenRun={onOpenRun} /> : null}
      <StepsCard steps={steps} />
      {run.input ? <PayloadCard title={messages.detail.input} value={run.input} /> : null}
      {run.result ? <PayloadCard title={messages.detail.result} value={run.result} /> : null}
      {run.error && !duplicateRunError ? (
        <ErrorCard title={messages.detail.runError} error={run.error} />
      ) : null}
    </div>
  )
}

function RunHeaderCard({ run, onOpenRun }: { run: WorkflowRun; onOpenRun?: (id: string) => void }) {
  const { formatDateTime, messages } = useWorkflowRunsUiI18nOrDefault()
  return (
    <Card>
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusIcon status={run.status} />
          <CardTitle className="font-semibold text-lg">{run.workflowName}</CardTitle>
          <StatusBadge status={run.status} messages={messages} />
          {run.durationMs != null ? (
            <Badge variant="outline" className="font-mono text-xs">
              {formatDuration(run.durationMs)}
            </Badge>
          ) : null}
          {run.resumeFromStep ? (
            <Badge variant="outline" className="font-mono text-xs">
              {messages.detail.resumedAt(run.resumeFromStep)}
            </Badge>
          ) : null}
          <CopyableId id={run.id} copiedLabel={messages.detail.copied} className="ml-auto" />
        </div>
        <div className="text-muted-foreground text-sm">
          <span>
            {messages.detail.started} {formatDateTime(run.startedAt)}
          </span>
          {run.completedAt ? (
            <span>
              {" · "}
              {messages.detail.finished} {formatDateTime(run.completedAt)}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <DefRow label={messages.detail.trigger} value={run.trigger} mono />
          {run.correlationId ? (
            <DefRow label={messages.detail.correlation} value={run.correlationId} mono />
          ) : null}
          {run.parentRunId ? (
            <LinkedRunRow
              label={messages.detail.parent}
              runId={run.parentRunId}
              onOpenRun={onOpenRun}
            />
          ) : null}
          {run.triggeredByUserId ? (
            <DefRow label={messages.detail.triggeredBy} value={run.triggeredByUserId} mono />
          ) : null}
        </dl>
        {run.tags.length > 0 ? (
          <div>
            <div className="mb-1.5 text-muted-foreground text-xs uppercase tracking-wide">
              {messages.detail.tags}
            </div>
            <div className="flex flex-wrap gap-1">
              {run.tags.map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function LinkedRunRow({
  label,
  runId,
  onOpenRun,
}: {
  label: string
  runId: string
  onOpenRun?: (id: string) => void
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="min-w-0 truncate">
        <button
          type="button"
          onClick={() => onOpenRun?.(runId)}
          className="inline-flex items-center gap-1.5 truncate font-mono text-xs hover:underline"
          title={runId}
        >
          <Link2 className="h-3 w-3 opacity-60" />
          {runId}
        </button>
      </dd>
    </div>
  )
}

function DefRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd
        className={
          mono ? "min-w-0 truncate font-mono text-xs" : "min-w-0 truncate text-sm" // i18n-literal-ok: CSS classes
        }
      >
        {value}
      </dd>
    </div>
  )
}

function RerunsListCard({
  reruns,
  onOpenRun,
}: {
  reruns: WorkflowRun[]
  onOpenRun?: (id: string) => void
}) {
  const { locale, messages } = useWorkflowRunsUiI18nOrDefault()
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          {messages.detail.reruns}
          <span className="font-normal text-muted-foreground text-xs">{`(${reruns.length})`}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {reruns.map((run) => (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => onOpenRun?.(run.id)}
                className="flex w-full items-center gap-2 rounded p-2 text-left text-sm hover:bg-muted/40"
              >
                <StatusIcon status={run.status} />
                <span className="font-mono text-xs">{run.id}</span>
                <span className="text-muted-foreground text-xs">{run.trigger}</span>
                {run.resumeFromStep ? (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {messages.detail.resumedAt(run.resumeFromStep)}
                  </Badge>
                ) : null}
                <span className="ml-auto whitespace-nowrap text-muted-foreground text-xs">
                  {formatRelative(run.startedAt, messages, locale)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function StepsCard({ steps }: { steps: WorkflowRunStep[] }) {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{messages.detail.steps}</CardTitle>
      </CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <p className="text-muted-foreground text-sm">{messages.detail.noSteps}</p>
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

function StepRow({ step }: { step: WorkflowRunStep }) {
  const messages = useWorkflowRunsUiMessagesOrDefault()
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
        <span className="font-medium">{`${step.sequence}. ${step.stepName}`}</span>
        {step.error ? (
          <span className="truncate text-destructive text-xs">{step.error.message}</span>
        ) : null}
        <span className="ml-auto whitespace-nowrap text-muted-foreground text-xs">
          {step.durationMs != null
            ? formatDuration(step.durationMs)
            : messages.detail.durationUnavailable}
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
          {step.output ? (
            <PayloadBlock title={messages.detail.output} value={step.output} messages={messages} />
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function PayloadCard({ title, value }: { title: string; value: Record<string, unknown> }) {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <PayloadBlock title={title} value={value} messages={messages} hideTitle />
      </CardContent>
    </Card>
  )
}

function ErrorCard({ title, error }: { title: string; error: WorkflowRunErrorPayload }) {
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

function ErrorBlock({ error }: { error: WorkflowRunErrorPayload }) {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  const [stackOpen, setStackOpen] = useState(false)
  return (
    <div className="space-y-2">
      <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <div className="font-medium text-destructive">{error.message}</div>
        {error.code || error.stepName ? (
          <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground text-xs">
            {error.code ? <span>{`${messages.detail.code} ${error.code}`}</span> : null}
            {error.stepName ? <span>{`${messages.detail.step} ${error.stepName}`}</span> : null}
          </div>
        ) : null}
      </div>
      {error.stack ? (
        <details
          open={stackOpen}
          onToggle={(event) => setStackOpen((event.target as HTMLDetailsElement).open)}
          className="rounded border bg-muted/30"
        >
          <summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-muted-foreground text-xs hover:text-foreground">
            {stackOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            {messages.detail.stackTrace}
          </summary>
          <pre className="overflow-x-auto whitespace-pre p-3 pt-0 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {error.stack}
          </pre>
        </details>
      ) : null}
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <Card className="border-destructive/40">
      <CardContent className="pt-4 text-destructive text-sm">{message}</CardContent>
    </Card>
  )
}
