"use client"

import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import { Card, CardContent } from "@voyant-travel/ui/components/card"
import { AlertTriangle, CalendarClock, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { useWorkflowRunsUiI18nOrDefault, type WorkflowRunsUiMessages } from "../i18n/index.js"
import type {
  ListWorkflowSchedulesResponse,
  WorkflowScheduleDecl,
  WorkflowScheduleSummary,
  WorkflowSchedulesApi,
} from "../schedules-client.js"
import type { WorkflowRun, WorkflowRunStatus, WorkflowRunsApi } from "../types.js"
import { formatRelative, StatusIcon } from "./common.js"

type SchedulesMessages = WorkflowRunsUiMessages["schedules"]

export interface WorkflowSchedulesPageProps {
  /** Schedules API — backed by `/api/schedules/:env`. */
  schedulesApi: WorkflowSchedulesApi
  /** Optional runs API — when provided, the page joins each row with the most recent matching run. */
  runsApi?: WorkflowRunsApi
  /**
   * Optional trigger callback. When provided, each row renders a
   * "Trigger now" button that calls this with the workflow id + the
   * schedule's recorded `input` payload (if any).
   */
  onTriggerNow?: (workflowId: string, input: unknown) => Promise<void>
  /** Manifest environment to inspect. Defaults to "production". */
  environment?: "production" | "preview" | "development"
  /** Auto-refresh interval (ms). Defaults to 30s. Pass 0 to disable. */
  pollIntervalMs?: number
  className?: string
}

export function WorkflowSchedulesPage({
  schedulesApi,
  runsApi,
  onTriggerNow,
  environment = "production",
  pollIntervalMs = 30_000,
  className,
}: WorkflowSchedulesPageProps) {
  const { locale, messages: rootMessages } = useWorkflowRunsUiI18nOrDefault()
  const messages = rootMessages.schedules
  const [response, setResponse] = useState<ListWorkflowSchedulesResponse | null>(null)
  const [lastRuns, setLastRuns] = useState<Record<string, WorkflowRun | null>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState<Record<string, boolean>>({})
  const [triggerNotice, setTriggerNotice] = useState<{
    kind: "success" | "error"
    text: string
  } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await schedulesApi.listSchedules(environment)
      setResponse(next)
      setError(null)
      if (runsApi) {
        const uniqueIds = Array.from(new Set(next.data.map((entry) => entry.workflowId)))
        const results = await Promise.all(
          uniqueIds.map(async (workflowId) => {
            try {
              const runs = await runsApi.listRuns({ workflowName: workflowId, limit: 1 })
              return [workflowId, runs.data[0] ?? null] as const
            } catch {
              return [workflowId, null] as const
            }
          }),
        )
        setLastRuns(Object.fromEntries(results))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.loadError)
    } finally {
      setLoading(false)
    }
  }, [environment, messages.loadError, runsApi, schedulesApi])

  useEffect(() => {
    void refresh()
    if (!pollIntervalMs) return
    const interval = setInterval(() => void refresh(), pollIntervalMs)
    return () => clearInterval(interval)
  }, [pollIntervalMs, refresh])

  const showEnvFlag = response?.schedulesEnabledByEnv !== undefined
  const envFlagOn = response?.schedulesEnabledByEnv === true

  const triggerRow = useCallback(
    async (entry: WorkflowScheduleSummary) => {
      if (!onTriggerNow) return
      setTriggering((prev) => ({ ...prev, [entry.scheduleId]: true }))
      setTriggerNotice(null)
      try {
        await onTriggerNow(entry.workflowId, entry.schedule.input)
        setTriggerNotice({ kind: "success", text: messages.triggerSuccess })
      } catch (err) {
        setTriggerNotice({
          kind: "error",
          text: err instanceof Error ? err.message : messages.triggerFailed,
        })
      } finally {
        setTriggering((prev) => ({ ...prev, [entry.scheduleId]: false }))
      }
    },
    [messages.triggerFailed, messages.triggerSuccess, onTriggerNow],
  )

  const rows = useMemo(() => response?.data ?? [], [response])

  return (
    <div className={`flex min-h-screen flex-col bg-background ${className ?? ""}`}>
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex flex-wrap items-center gap-3 px-4 py-3">
          <CalendarClock className="h-5 w-5" />
          <div className="min-w-0">
            <h1 className="font-semibold text-base">{messages.title}</h1>
            <p className="text-muted-foreground text-xs">{messages.subtitle}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-muted-foreground text-xs">
            <span>
              {messages.environmentLabel}: <span className="font-mono">{environment}</span>
            </span>
            {response?.versionId ? (
              <span>
                {messages.versionLabel}:{" "}
                <span className="font-mono">{response.versionId.slice(0, 12)}</span>
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {messages.refresh}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex flex-1 flex-col gap-4 px-4 py-6">
        {showEnvFlag && !envFlagOn ? (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="flex items-center gap-2 pt-4 text-amber-700 text-sm dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {messages.envFlagOff}
            </CardContent>
          </Card>
        ) : null}

        {triggerNotice ? (
          <Card
            className={
              triggerNotice.kind === "success"
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/40 bg-destructive/5"
            }
          >
            <CardContent
              className={`pt-4 text-sm ${
                triggerNotice.kind === "success"
                  ? "text-emerald-600 dark:text-emerald-300"
                  : "text-destructive"
              }`}
            >
              {triggerNotice.text}
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <Card className="border-destructive/40">
            <CardContent className="pt-4 text-destructive text-sm">{error}</CardContent>
          </Card>
        ) : null}

        {!error && rows.length === 0 && !loading ? (
          <Card>
            <CardContent className="pt-4 text-muted-foreground text-sm">
              {messages.empty}
            </CardContent>
          </Card>
        ) : null}

        {rows.length > 0 ? (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">{messages.workflowColumn}</th>
                  <th className="px-3 py-2 font-medium">{messages.scheduleColumn}</th>
                  <th className="px-3 py-2 font-medium">{messages.nextRunColumn}</th>
                  <th className="px-3 py-2 font-medium">{messages.lastRunColumn}</th>
                  <th className="px-3 py-2 font-medium">{messages.statusColumn}</th>
                  {onTriggerNow ? (
                    <th className="px-3 py-2 font-medium">{messages.actionsColumn}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ScheduleRow
                    key={row.scheduleId}
                    row={row}
                    lastRun={lastRuns[row.workflowId] ?? null}
                    triggering={!!triggering[row.scheduleId]}
                    onTriggerNow={onTriggerNow ? () => void triggerRow(row) : undefined}
                    envFlagDisabled={showEnvFlag && !envFlagOn}
                    rootMessages={rootMessages}
                    locale={locale}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  )
}

function ScheduleRow({
  row,
  lastRun,
  triggering,
  onTriggerNow,
  envFlagDisabled,
  rootMessages,
  locale,
}: {
  row: WorkflowScheduleSummary
  lastRun: WorkflowRun | null
  triggering: boolean
  onTriggerNow?: () => void
  envFlagDisabled: boolean
  rootMessages: WorkflowRunsUiMessages
  locale: string
}) {
  const messages = rootMessages.schedules

  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-mono text-xs">{row.workflowId}</td>
      <td className="px-3 py-2 font-mono text-xs">{formatScheduleDecl(row.schedule, messages)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {formatNextRun(row, messages, rootMessages, locale)}
      </td>
      <td className="px-3 py-2 text-xs">
        {formatLastRun(lastRun, row, messages, rootMessages, locale)}
      </td>
      <td className="px-3 py-2">
        <StatusPill row={row} envFlagDisabled={envFlagDisabled} messages={messages} />
      </td>
      {onTriggerNow ? (
        <td className="px-3 py-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onTriggerNow}
            disabled={triggering}
          >
            {triggering ? messages.triggering : messages.triggerNow}
          </Button>
        </td>
      ) : null}
    </tr>
  )
}

function StatusPill({
  row,
  envFlagDisabled,
  messages,
}: {
  row: WorkflowScheduleSummary
  envFlagDisabled: boolean
  messages: SchedulesMessages
}) {
  if (envFlagDisabled) {
    return (
      <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
        {messages.disabledByEnvFlag}
      </Badge>
    )
  }
  if (row.disabledReason === "registration_disabled") {
    return (
      <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
        {messages.disabledByRegistration}
      </Badge>
    )
  }
  if (row.disabledReason === "env_filtered") {
    return (
      <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
        {messages.disabledByEnvironment}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
    >
      {messages.enabled}
    </Badge>
  )
}

function formatScheduleDecl(decl: WorkflowScheduleDecl, messages: SchedulesMessages): string {
  if (decl.cron) return messages.cron(decl.cron, decl.timezone ?? "UTC")
  if (decl.every !== undefined) return messages.every(String(decl.every))
  if (decl.at) return messages.at(decl.at)
  return messages.eventDriven
}

function formatNextRun(
  row: WorkflowScheduleSummary,
  messages: SchedulesMessages,
  rootMessages: WorkflowRunsUiMessages,
  locale: string,
): string {
  if (!row.enabled || row.nextRunAt === null) return messages.notScheduled
  const delta = row.nextRunAt - Date.now()
  const relative = formatRelative(new Date(row.nextRunAt).toISOString(), rootMessages, locale)
  return delta >= 0 ? messages.inFuture(relative) : messages.inPast(relative)
}

function formatLastRun(
  lastRun: WorkflowRun | null,
  row: WorkflowScheduleSummary,
  messages: SchedulesMessages,
  rootMessages: WorkflowRunsUiMessages,
  locale: string,
) {
  if (lastRun) {
    const relative = formatRelative(lastRun.startedAt, rootMessages, locale)
    const label = lastRunLabel(lastRun.status, relative, messages)
    return (
      <span className="inline-flex items-center gap-1.5">
        <StatusIcon status={lastRun.status} />
        {label}
      </span>
    )
  }
  if (row.lastError && row.lastFireAt !== undefined && row.lastFireAt !== null) {
    const relative = formatRelative(new Date(row.lastFireAt).toISOString(), rootMessages, locale)
    return (
      <span className="inline-flex items-center gap-1.5" title={row.lastError}>
        <StatusIcon status="failed" />
        {messages.lastRunFailed(relative)}
      </span>
    )
  }
  if (row.lastSuccessfulRunAt !== undefined && row.lastSuccessfulRunAt !== null) {
    const relative = formatRelative(
      new Date(row.lastSuccessfulRunAt).toISOString(),
      rootMessages,
      locale,
    )
    return (
      <span className="inline-flex items-center gap-1.5">
        <StatusIcon status="succeeded" />
        {messages.lastRunSucceeded(relative)}
      </span>
    )
  }
  if (row.lastFireAt !== undefined && row.lastFireAt !== null) {
    const relative = formatRelative(new Date(row.lastFireAt).toISOString(), rootMessages, locale)
    return (
      <span className="inline-flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        {messages.lastFireRecorded(relative)}
      </span>
    )
  }
  return <span className="text-muted-foreground">{messages.lastRunNone}</span>
}

function lastRunLabel(
  status: WorkflowRunStatus,
  relative: string,
  messages: SchedulesMessages,
): string {
  switch (status) {
    case "succeeded":
      return messages.lastRunSucceeded(relative)
    case "failed":
      return messages.lastRunFailed(relative)
    case "running":
      return messages.lastRunRunning
    case "cancelled":
      return messages.lastRunCancelled(relative)
  }
}
