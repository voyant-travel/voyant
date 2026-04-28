// Parked-run controls. For EVENT/SIGNAL/MANUAL waitpoints, offers a
// payload-JSON editor + Resolve button. For DATETIME (ctx.sleep) shows
// the wake time but no form — sleeps resume themselves. For RUN
// waitpoints, shows the child workflow id; parent resumes when the
// child reaches a terminal status.

import { Alert, AlertDescription } from "@voyantjs/ui/components/alert"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { cn } from "@voyantjs/ui/lib/utils"
import { Clock, GitBranch, Pause, Tag, Webhook, XCircle } from "lucide-react"
import { useState } from "react"
import { JsonEditor } from "@/components/json-editor"

import {
  cancelRun,
  type PendingWaitpoint,
  pendingWaitpoints,
  resolveWaitpoint,
  type StoredRun,
} from "@/lib/api"
import { formatTime } from "@/lib/utils"

export function WaitpointPanel({
  run,
  onRunUpdated,
}: {
  run: StoredRun
  onRunUpdated: (run: StoredRun) => void
}): React.ReactElement | null {
  if (run.status !== "waiting") return null
  const pending = pendingWaitpoints(run)
  if (pending.length === 0) return null

  return (
    <div className="border-amber-500/30 bg-amber-500/5 rounded-md border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Pause className="size-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Parked — waiting on {pending.length} waitpoint{pending.length === 1 ? "" : "s"}
        </span>
        <CancelButton run={run} onRunUpdated={onRunUpdated} />
      </div>

      <div className="space-y-2">
        {pending.map((wp) => (
          <WaitpointRow key={wp.clientWaitpointId} run={run} wp={wp} onRunUpdated={onRunUpdated} />
        ))}
      </div>
    </div>
  )
}

function CancelButton({
  run,
  onRunUpdated,
}: {
  run: StoredRun
  onRunUpdated: (run: StoredRun) => void
}): React.ReactElement {
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "in-flight" } | { kind: "error"; message: string }
  >({ kind: "idle" })

  const onClick = async (): Promise<void> => {
    setState({ kind: "in-flight" })
    const result = await cancelRun(run.id)
    if (!result.ok) {
      setState({ kind: "error", message: result.message })
      return
    }
    onRunUpdated(result.saved)
    setState({ kind: "idle" })
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      className="ml-auto"
      onClick={onClick}
      disabled={state.kind === "in-flight"}
      title={state.kind === "error" ? state.message : undefined}
    >
      <XCircle className="size-3.5" />
      {state.kind === "in-flight" ? "Cancelling…" : "Cancel"}
    </Button>
  )
}

function WaitpointRow({
  run,
  wp,
  onRunUpdated,
}: {
  run: StoredRun
  wp: PendingWaitpoint
  onRunUpdated: (run: StoredRun) => void
}): React.ReactElement {
  // DATETIME and RUN resume themselves — render read-only rows.
  if (wp.kind === "DATETIME") {
    const wakeAt = typeof wp.meta.wakeAt === "number" ? wp.meta.wakeAt : undefined
    return (
      <InfoRow icon={<Clock className="size-3.5" />} kind={wp.kind} title={wp.clientWaitpointId}>
        {wakeAt !== undefined && (
          <span className="text-muted-foreground text-xs">
            wakes at <span className="font-mono">{formatTime(wakeAt)}</span>
          </span>
        )}
      </InfoRow>
    )
  }
  if (wp.kind === "RUN") {
    const childId = wp.meta.childWorkflowId ? String(wp.meta.childWorkflowId) : wp.clientWaitpointId
    return (
      <InfoRow icon={<GitBranch className="size-3.5" />} kind={wp.kind} title={childId}>
        <span className="text-muted-foreground text-xs">
          resumes when child reaches a terminal status
        </span>
      </InfoRow>
    )
  }

  return <ResolvableRow run={run} wp={wp} onRunUpdated={onRunUpdated} />
}

function ResolvableRow({
  run,
  wp,
  onRunUpdated,
}: {
  run: StoredRun
  wp: PendingWaitpoint
  onRunUpdated: (run: StoredRun) => void
}): React.ReactElement {
  const [payloadText, setPayloadText] = useState<string>("{}")
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "in-flight" } | { kind: "error"; message: string }
  >({ kind: "idle" })

  const onSubmit = async (): Promise<void> => {
    let payload: unknown
    if (payloadText.trim() === "") {
      payload = undefined
    } else {
      try {
        payload = JSON.parse(payloadText)
      } catch (e) {
        setState({ kind: "error", message: `payload JSON is invalid: ${String(e)}` })
        return
      }
    }
    setState({ kind: "in-flight" })
    const result = await resolveWaitpoint(run.id, wp, payload)
    if (!result.ok) {
      setState({ kind: "error", message: result.message })
      return
    }
    onRunUpdated(result.saved)
    setState({ kind: "idle" })
  }

  const label = waitpointLabel(wp)
  const icon =
    wp.kind === "EVENT" ? (
      <Webhook className="size-3.5" />
    ) : wp.kind === "MANUAL" ? (
      <Tag className="size-3.5" />
    ) : (
      <Clock className="size-3.5" />
    ) // SIGNAL fallback

  return (
    <div className="border-amber-500/20 bg-background/50 rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px]">
          <span className={cn("inline-flex items-center gap-1")}>
            {icon}
            {wp.kind}
          </span>
        </Badge>
        <span className="font-mono text-xs">{label}</span>
      </div>
      <JsonEditor
        value={payloadText}
        onChange={setPayloadText}
        minHeight="90px"
        maxHeight="240px"
        aria-label="Resolution payload"
      />
      {state.kind === "error" && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">{state.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={onSubmit} disabled={state.kind === "in-flight"}>
          {state.kind === "in-flight" ? "Resolving…" : "Resolve"}
        </Button>
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  kind,
  title,
  children,
}: {
  icon: React.ReactNode
  kind: string
  title: string
  children?: React.ReactNode
}): React.ReactElement {
  return (
    <div className="border-amber-500/20 bg-background/50 flex items-center gap-3 rounded-md border p-3">
      <Badge variant="outline" className="font-mono text-[10px]">
        <span className="inline-flex items-center gap-1">
          {icon}
          {kind}
        </span>
      </Badge>
      <span className="font-mono text-xs">{title}</span>
      <div className="ml-auto">{children}</div>
    </div>
  )
}

function waitpointLabel(wp: PendingWaitpoint): string {
  if (wp.kind === "EVENT") return String(wp.meta.eventType ?? wp.clientWaitpointId)
  if (wp.kind === "SIGNAL") return String(wp.meta.signalName ?? wp.clientWaitpointId)
  if (wp.kind === "MANUAL") return String(wp.meta.tokenId ?? wp.clientWaitpointId)
  return wp.clientWaitpointId
}
