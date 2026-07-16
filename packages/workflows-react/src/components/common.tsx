"use client"

import { Badge } from "@voyant-travel/ui/components/badge"
import { AlertCircle, CheckCircle2, Clock, Copy, RefreshCw, XCircle } from "lucide-react"
import { useMemo, useState } from "react"

import { useWorkflowRunsUiMessagesOrDefault, type WorkflowRunsUiMessages } from "../i18n/index.js"
import type { WorkflowRun, WorkflowRunStep, WorkflowRunStepStatus } from "../types.js"

export function StatusIcon({ status }: { status: WorkflowRun["status"] }) {
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

export function StepStatusIcon({ status }: { status: WorkflowRunStepStatus }) {
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

export function StatusBadge({
  status,
  messages,
}: {
  status: WorkflowRun["status"]
  messages: WorkflowRunsUiMessages
}) {
  useWorkflowRunsUiMessagesOrDefault()
  const className = {
    succeeded: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300", // i18n-literal-ok: CSS classes
    failed: "border-destructive/40 bg-destructive/10 text-destructive", // i18n-literal-ok: CSS classes
    cancelled: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300", // i18n-literal-ok: CSS classes
    running: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300", // i18n-literal-ok: CSS classes
  }[status]
  return (
    <Badge variant="outline" className={`text-[11px] ${className}`}>
      {messages.status[status]}
    </Badge>
  )
}

export function TagChip({ tag }: { tag: string }) {
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

export function CopyableId({
  id,
  copiedLabel,
  className,
}: {
  id: string
  copiedLabel: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
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
      {copied ? <span className="text-emerald-500 text-[10px]">{copiedLabel}</span> : null}
    </button>
  )
}

export function PayloadBlock({
  title,
  value,
  messages,
  hideTitle = false,
}: {
  title: string
  value: Record<string, unknown>
  messages: WorkflowRunsUiMessages
  hideTitle?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const json = useMemo(() => JSON.stringify(value, null, 2), [value])

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
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
            {copied ? messages.detail.copied : messages.detail.copy}
          </button>
        </div>
      )}
      <pre className="max-h-[24rem] overflow-auto rounded bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
        {json}
      </pre>
    </div>
  )
}

export function formatRelative(
  iso: string,
  messages: WorkflowRunsUiMessages,
  locale: string,
): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (Math.abs(seconds) < 5) return messages.format.relativeNow
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (Math.abs(seconds) < 60) return formatter.format(-seconds, "second")
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return formatter.format(-minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(-hours, "hour")
  const days = Math.round(hours / 24)
  return formatter.format(-days, "day")
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

export function runHasLiveStatus(run: WorkflowRun | WorkflowRunStep): boolean {
  return run.status === "running"
}
