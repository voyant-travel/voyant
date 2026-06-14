"use client"

import { Button } from "@voyant-travel/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyant-travel/ui/components/card"
import { AlertTriangle, Play, RotateCw } from "lucide-react"
import { useCallback, useState } from "react"

import { useWorkflowRunsUiMessagesOrDefault } from "../i18n/index.js"
import type { WorkflowRun, WorkflowRunActionError, WorkflowRunsApi } from "../types.js"
import { runHasLiveStatus } from "./common.js"

export function WorkflowRunActionsCard({
  api,
  run,
  onOpenRun,
}: {
  api: WorkflowRunsApi
  run: WorkflowRun
  onOpenRun?: (id: string) => void
}) {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  const [busy, setBusy] = useState<"rerun" | "resume" | null>(null)
  const [feedback, setFeedback] = useState<{ kind: "info" | "error"; message: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const explainError = useCallback(
    (err: WorkflowRunActionError): string => {
      if (err.error === "runner_not_registered") return messages.actions.runnerMissing
      if (err.error === "rerun_blocked") return err.detail ?? messages.actions.rerunBlocked
      if (err.error === "incomplete_prior_step") {
        return err.detail ?? messages.actions.incompletePriorStep
      }
      return err.detail ?? err.error ?? messages.actions.actionFailed
    },
    [messages],
  )

  const doRerun = async (confirm: boolean): Promise<void> => {
    setBusy("rerun")
    setFeedback(null)
    try {
      const result = await api.rerunRun(run.id, { confirm })
      if (result.ok) {
        setFeedback({ kind: "info", message: messages.actions.rerunStarted })
        onOpenRun?.(result.data.runId)
        setConfirmOpen(false)
      } else if (result.error.error === "confirmation_required") {
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
      const result = await api.resumeRun(run.id)
      if (result.ok) {
        setFeedback({
          kind: "info",
          message: messages.actions.resumeStarted(result.data.resumeFromStep ?? ""),
        })
        onOpenRun?.(result.data.runId)
      } else {
        setFeedback({ kind: "error", message: explainError(result.error) })
      }
    } finally {
      setBusy(null)
    }
  }

  const canResume = run.status === "failed"
  const isRunning = runHasLiveStatus(run)

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 pt-4">
        <Button
          variant="default"
          size="sm"
          onClick={() => void doRerun(false)}
          disabled={busy !== null || isRunning}
          title={isRunning ? messages.actions.waitForCompletion : messages.actions.rerunDescription}
        >
          <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${busy === "rerun" ? "animate-spin" : ""}`} />
          {busy === "rerun" ? messages.actions.rerunBusy : messages.actions.rerun}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void doResume()}
          disabled={busy !== null || !canResume}
          title={
            canResume ? messages.actions.resumeDescription : messages.actions.resumeUnavailable
          }
        >
          <Play className={`mr-1.5 h-3.5 w-3.5 ${busy === "resume" ? "animate-pulse" : ""}`} />
          {busy === "resume" ? messages.actions.resumeBusy : messages.actions.resume}
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
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void doRerun(true)}
          busy={busy === "rerun"}
        />
      ) : null}
    </Card>
  )
}

function ConfirmRerunDialog({
  onCancel,
  onConfirm,
  busy,
}: {
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
}) {
  const messages = useWorkflowRunsUiMessagesOrDefault()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md border-amber-500/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {messages.actions.confirmTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{messages.actions.confirmBody}</p>
          <p className="text-muted-foreground text-xs">{messages.actions.confirmTip}</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
              {messages.actions.cancel}
            </Button>
            <Button variant="default" size="sm" onClick={onConfirm} disabled={busy}>
              <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
              {messages.actions.rerunAnyway}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
