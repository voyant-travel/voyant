"use client"

import { Button } from "@voyant-travel/ui/components/button"
import { Card, CardContent } from "@voyant-travel/ui/components/card"
import { Clock, Workflow } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  useWorkflowRunsUiI18nOrDefault,
  useWorkflowRunsUiMessagesOrDefault,
} from "../i18n/index.js"
import type {
  ListWorkflowRunsQuery,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowRunsApi,
} from "../types.js"
import { formatDuration, formatRelative, StatusBadge, StatusIcon, TagChip } from "./common.js"
import { WorkflowRunDetailPage } from "./workflow-run-detail-page.js"
import { buildFilterOptions, type TimeRange, WorkflowRunsFilters } from "./workflow-runs-filters.js"

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
  const [statusFilters, setStatusFilters] = useState<WorkflowRunStatus[]>(
    initialFilters?.status ? [initialFilters.status] : [],
  )
  const [tagFilters, setTagFilters] = useState<string[]>(
    initialFilters?.tag ? [initialFilters.tag] : [],
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [timeRange, setTimeRange] = useState<TimeRange>("24h")
  const [live, setLive] = useState(false)
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [localSelectedRunId, setLocalSelectedRunId] = useState<string | null>(null)
  const activeRunId = selectedRunId !== undefined ? selectedRunId : localSelectedRunId

  const serverFilters = useMemo(
    () => ({
      ...filters,
      status: statusFilters.length === 1 ? statusFilters[0] : undefined,
      tag: tagFilters.length === 1 ? tagFilters[0] : undefined,
    }),
    [filters, statusFilters, tagFilters],
  )

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      if (typeof document !== "undefined" && document.hidden) return
      setLoading(true)
      try {
        const res = await api.listRuns(serverFilters)
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
    const interval = setInterval(() => void refresh(), live ? 1000 : pollIntervalMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [api, live, messages.page.loadError, pollIntervalMs, serverFilters])

  const filterOptions = useMemo(
    () => buildFilterOptions(runs, filters.workflowName),
    [filters.workflowName, runs],
  )
  const filteredRuns = useMemo(
    () => filterRuns({ runs, statusFilters, tagFilters, searchQuery, timeRange }),
    [runs, searchQuery, statusFilters, tagFilters, timeRange],
  )

  const openRun = (id: string) => {
    setLocalSelectedRunId(id)
    onOpenRun?.(id)
  }
  const toggleStatus = (status: WorkflowRunStatus) => {
    setStatusFilters((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status],
    )
  }
  const addTagFilter = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    setTagFilters((current) => (current.includes(trimmed) ? current : [...current, trimmed]))
  }
  const removeTagFilter = (tag: string) =>
    setTagFilters((current) => current.filter((item) => item !== tag))

  return (
    <div className={`flex min-h-screen flex-col bg-background ${className ?? ""}`}>
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3">
          <Workflow className="h-5 w-5" />
          <div className="min-w-0">
            <h1 className="font-semibold text-base">{messages.page.title}</h1>
            <p className="text-muted-foreground text-xs">{messages.page.subtitle}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant={live ? "default" : "outline"}
              size="sm"
              onClick={() => setLive((value) => !value)}
              aria-pressed={live}
            >
              <Clock data-icon="inline-start" aria-hidden="true" />
              {messages.page.live}
            </Button>
            <span className="text-muted-foreground text-xs">
              {messages.page.filteredRunCount(filteredRuns.length, runs.length)}
            </span>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="space-y-3 md:w-96 md:shrink-0">
          <WorkflowRunsFilters
            filters={filters}
            workflowOptions={filterOptions.workflows}
            tagOptions={filterOptions.tags}
            statusFilters={statusFilters}
            tagFilters={tagFilters}
            searchQuery={searchQuery}
            timeRange={timeRange}
            onChange={setFilters}
            onToggleStatus={toggleStatus}
            onAddTagFilter={addTagFilter}
            onRemoveTagFilter={removeTagFilter}
            onSearchChange={setSearchQuery}
            onTimeRangeChange={setTimeRange}
            onClear={() => {
              setFilters({ limit: filters.limit ?? 50 })
              setStatusFilters([])
              setTagFilters([])
              setSearchQuery("")
              setTimeRange("24h")
            }}
          />
          {error ? (
            <Card className="border-destructive/40">
              <CardContent className="pt-4 text-destructive text-sm">{error}</CardContent>
            </Card>
          ) : null}
          <div className="space-y-2">
            {filteredRuns.length === 0 && !loading ? (
              <Card>
                <CardContent className="pt-4 text-muted-foreground text-sm">
                  {messages.page.empty}
                </CardContent>
              </Card>
            ) : null}
            {filteredRuns.map((run) => (
              <RunListItem
                key={run.id}
                run={run}
                selected={activeRunId === run.id}
                activeTagFilters={tagFilters}
                activeStatusFilters={statusFilters}
                onSelect={() => openRun(run.id)}
                onToggleStatus={toggleStatus}
                onToggleTag={(tag) =>
                  tagFilters.includes(tag) ? removeTagFilter(tag) : addTagFilter(tag)
                }
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
        <aside className="space-y-3 md:w-96 md:shrink-0">
          <div className="h-56 rounded-md bg-muted" />
          <div className="h-20 rounded-md bg-muted" />
          <div className="h-20 rounded-md bg-muted" />
        </aside>
        <section className="min-h-[24rem] flex-1 rounded-md bg-muted" />
      </main>
    </div>
  )
}

function RunListItem({
  run,
  selected,
  activeTagFilters,
  activeStatusFilters,
  onSelect,
  onToggleStatus,
  onToggleTag,
}: {
  run: WorkflowRun
  selected: boolean
  activeTagFilters: string[]
  activeStatusFilters: WorkflowRunStatus[]
  onSelect: () => void
  onToggleStatus: (status: WorkflowRunStatus) => void
  onToggleTag: (tag: string) => void
}) {
  const { locale, messages } = useWorkflowRunsUiI18nOrDefault()
  return (
    <div
      className={`rounded-md border bg-card p-3 text-sm transition-colors hover:bg-muted/50 ${
        selected ? "border-primary bg-primary/5" : "" // i18n-literal-ok: CSS classes
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <StatusIcon status={run.status} />
          <span className="truncate font-medium">{run.workflowName}</span>
          <span className="ml-auto whitespace-nowrap text-muted-foreground text-xs">
            {formatRelative(run.startedAt, messages, locale)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onToggleStatus(run.status)}
          aria-pressed={activeStatusFilters.includes(run.status)}
        >
          <StatusBadge status={run.status} messages={messages} />
        </button>
      </div>
      {run.durationMs != null ? (
        <div className="mt-1 text-muted-foreground text-xs">{formatDuration(run.durationMs)}</div>
      ) : null}
      {run.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {run.tags.slice(0, 3).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              aria-pressed={activeTagFilters.includes(tag)}
              className={
                activeTagFilters.includes(tag) ? "rounded-full ring-2 ring-primary/40" : undefined
              }
            >
              <TagChip tag={tag} />
            </button>
          ))}
          {run.tags.length > 3 ? (
            <span className="text-muted-foreground text-xs">{`+${run.tags.length - 3}`}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SelectPrompt() {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  return (
    <Card>
      <CardContent className="flex min-h-[24rem] items-center justify-center text-muted-foreground text-sm">
        {messages.page.selectPrompt}
      </CardContent>
    </Card>
  )
}

function filterRuns({
  runs,
  statusFilters,
  tagFilters,
  searchQuery,
  timeRange,
}: {
  runs: WorkflowRun[]
  statusFilters: WorkflowRunStatus[]
  tagFilters: string[]
  searchQuery: string
  timeRange: TimeRange
}) {
  const search = searchQuery.trim().toLowerCase()
  const cutoff = rangeCutoff(timeRange)

  return runs.filter((run) => {
    if (statusFilters.length > 0 && !statusFilters.includes(run.status)) return false
    if (tagFilters.length > 0 && !tagFilters.every((tag) => run.tags.includes(tag))) return false
    if (cutoff && new Date(run.startedAt).getTime() < cutoff) return false
    if (!search) return true
    return runSearchText(run).includes(search)
  })
}

function rangeCutoff(range: TimeRange) {
  if (range === "all") return null
  const minutes =
    range === "15m" ? 15 : range === "1h" ? 60 : range === "24h" ? 24 * 60 : 7 * 24 * 60
  return Date.now() - minutes * 60_000
}

function runSearchText(run: WorkflowRun) {
  return [
    run.id,
    run.workflowName,
    run.trigger,
    run.correlationId,
    run.status,
    ...run.tags,
    run.error?.message,
    run.error?.code,
    run.input ? JSON.stringify(run.input) : null,
    run.result ? JSON.stringify(run.result) : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}
