"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Input } from "@voyantjs/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Workflow } from "lucide-react"
import { useEffect, useState } from "react"

import { useWorkflowRunsUiMessagesOrDefault } from "../i18n/index.js"
import type { ListWorkflowRunsQuery, WorkflowRun, WorkflowRunsApi } from "../types.js"
import { formatDuration, formatRelative, StatusIcon, TagChip } from "./common.js"
import { WorkflowRunDetailPage } from "./workflow-run-detail-page.js"

export interface WorkflowRunsPageProps {
  api: WorkflowRunsApi
  selectedRunId?: string | null
  onOpenRun?: (id: string) => void
  initialFilters?: ListWorkflowRunsQuery
  pollIntervalMs?: number
  className?: string
}

export function WorkflowRunsPage({
  api,
  selectedRunId,
  onOpenRun,
  initialFilters,
  pollIntervalMs = 5000,
  className,
}: WorkflowRunsPageProps) {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  const [filters, setFilters] = useState<ListWorkflowRunsQuery>(initialFilters ?? { limit: 50 })
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [localSelectedRunId, setLocalSelectedRunId] = useState<string | null>(null)
  const activeRunId = selectedRunId !== undefined ? selectedRunId : localSelectedRunId

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      setLoading(true)
      try {
        const res = await api.listRuns(filters)
        if (!cancelled) {
          setRuns(res.data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : messages.page.loadError)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void refresh()
    const interval = setInterval(() => void refresh(), pollIntervalMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [api, filters, messages.page.loadError, pollIntervalMs])

  const openRun = (id: string) => {
    setLocalSelectedRunId(id)
    onOpenRun?.(id)
  }

  return (
    <div className={`flex min-h-screen flex-col bg-background ${className ?? ""}`}>
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3">
          <Workflow className="h-5 w-5" />
          <div className="min-w-0">
            <h1 className="font-semibold text-base">{messages.page.title}</h1>
            <p className="text-muted-foreground text-xs">{messages.page.subtitle}</p>
          </div>
          <span className="ml-auto text-muted-foreground text-xs">
            {messages.page.runCount(runs.length)}
          </span>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="space-y-3 md:w-80 md:shrink-0">
          <WorkflowRunsFilters filters={filters} onChange={setFilters} />
          {error ? (
            <Card className="border-destructive/40">
              <CardContent className="pt-4 text-destructive text-sm">{error}</CardContent>
            </Card>
          ) : null}
          <div className="space-y-2">
            {runs.length === 0 && !loading ? (
              <Card>
                <CardContent className="pt-4 text-muted-foreground text-sm">
                  {messages.page.empty}
                </CardContent>
              </Card>
            ) : null}
            {runs.map((run) => (
              <RunListItem
                key={run.id}
                run={run}
                selected={activeRunId === run.id}
                onSelect={() => openRun(run.id)}
              />
            ))}
          </div>
        </aside>
        <section className="min-w-0 flex-1">
          {activeRunId ? (
            <WorkflowRunDetailPage api={api} runId={activeRunId} onOpenRun={openRun} />
          ) : (
            <SelectPrompt />
          )}
        </section>
      </main>
    </div>
  )
}

export function WorkflowRunsPageSkeleton() {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b px-4 py-3">
        <div
          className="h-5 w-40 rounded bg-muted"
          role="status"
          aria-label={messages.page.loading}
        />
      </header>
      <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="space-y-3 md:w-80 md:shrink-0">
          <div className="h-40 rounded-md bg-muted" />
          <div className="h-20 rounded-md bg-muted" />
          <div className="h-20 rounded-md bg-muted" />
        </aside>
        <section className="min-h-[24rem] flex-1 rounded-md bg-muted" />
      </main>
    </div>
  )
}

function WorkflowRunsFilters({
  filters,
  onChange,
}: {
  filters: ListWorkflowRunsQuery
  onChange: (next: ListWorkflowRunsQuery) => void
}) {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{messages.page.filterTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label={messages.page.workflowLabel}>
          <Input
            placeholder={messages.page.workflowPlaceholder}
            value={filters.workflowName ?? ""}
            onChange={(event) =>
              onChange({ ...filters, workflowName: event.target.value || undefined })
            }
          />
        </Field>
        <Field label={messages.page.statusLabel}>
          <Select
            value={filters.status ?? "any"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                status: value === "any" ? undefined : (value as WorkflowRun["status"]),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{messages.page.anyStatus}</SelectItem>
              <SelectItem value="running">{messages.status.running}</SelectItem>
              <SelectItem value="succeeded">{messages.status.succeeded}</SelectItem>
              <SelectItem value="failed">{messages.status.failed}</SelectItem>
              <SelectItem value="cancelled">{messages.status.cancelled}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={messages.page.tagLabel}>
          <Input
            placeholder={messages.page.tagPlaceholder}
            value={filters.tag ?? ""}
            onChange={(event) => onChange({ ...filters, tag: event.target.value || undefined })}
          />
        </Field>
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
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
}) {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border bg-card p-3 text-left text-sm transition-colors hover:bg-muted/50 ${
        selected ? "border-primary bg-primary/5" : "" // i18n-literal-ok: CSS classes
      }`}
    >
      <div className="flex items-center gap-2">
        <StatusIcon status={run.status} />
        <span className="truncate font-medium">{run.workflowName}</span>
        <span className="ml-auto whitespace-nowrap text-muted-foreground text-xs">
          {formatRelative(run.startedAt, messages)}
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
            <span className="text-muted-foreground text-xs">{`+${run.tags.length - 3}`}</span>
          ) : null}
        </div>
      ) : null}
    </button>
  )
}

function SelectPrompt() {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  return (
    <Card>
      <CardContent className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center text-muted-foreground text-sm">
        <Workflow className="h-6 w-6 opacity-60" />
        {messages.page.selectPrompt}
      </CardContent>
    </Card>
  )
}
