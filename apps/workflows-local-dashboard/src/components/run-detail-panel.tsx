// Detail pane for the currently-selected run.
//
// Phase 4 layout: header + nested resizable split. Timeline on the
// left, span-detail pane on the right. The span-detail pane always
// renders (defaults to the run-root span); pressing `Esc` snaps
// selection back to the run root. `R` triggers replay.

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@voyant-travel/ui/components/breadcrumb"
import { Button } from "@voyant-travel/ui/components/button"
import { Kbd } from "@voyant-travel/ui/components/kbd"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@voyant-travel/ui/components/resizable"
import { ScrollArea } from "@voyant-travel/ui/components/scroll-area"
import { Separator } from "@voyant-travel/ui/components/separator"
import { History, RotateCcw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { StatusBadge } from "@/components/status-badge"
import { RunTimeline } from "@/components/timeline/run-timeline"
import { SpanDetailPane } from "@/components/timeline/span-detail"
import { buildRootSpan, buildSpans } from "@/components/timeline/timeline-spans"
import type { Span } from "@/components/timeline/timeline-types"
import { WaitpointPanel } from "@/components/waitpoint-panel"
import { replayRun, type StoredRun } from "@/lib/api"

export function RunDetailPanel({
  run,
  onRunUpdated,
}: {
  run: StoredRun
  onRunUpdated: (run: StoredRun) => void
}): React.ReactElement {
  const [selectedSpanId, setSelectedSpanId] = useState<string>("run")
  const [replay, setReplay] = useState<ReplayState>({ kind: "idle" })

  // Reset selection and replay-toast when switching to a different run.
  useEffect(() => {
    setSelectedSpanId("run")
    setReplay({ kind: "idle" })
  }, [])

  // Resolve the currently-selected span from the live span list so
  // in-flight data (pending endAt, new output) reaches the detail
  // pane without a separate selection-object copy getting stale.
  const selectedSpan = useMemo((): Span => {
    const now = Date.now()
    const root = buildRootSpan(run, now)
    if (selectedSpanId === "run") return root
    const all = buildSpans(run)
    return all.find((s) => s.id === selectedSpanId) ?? root
  }, [run, selectedSpanId])

  const onReplay = useCallback(async () => {
    setReplay({ kind: "in-flight" })
    const result = await replayRun(run.id)
    if (!result.ok) {
      setReplay({ kind: "error", message: result.message })
      return
    }
    setReplay({ kind: "done", newRunId: result.newRunId })
  }, [run.id])

  const closeDetail = useCallback(() => {
    setSelectedSpanId("run")
  }, [])

  // Keyboard shortcuts scoped to the detail panel.
  //   Esc → reset selection to the run root (a.k.a. close)
  //   R   → replay the run
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && isEditable(t)) return
      if (e.key === "Escape" && selectedSpanId !== "run") {
        e.preventDefault()
        closeDetail()
      } else if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        void onReplay()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [selectedSpanId, closeDetail, onReplay])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DetailHeader run={run} replay={replay} onReplay={onReplay} />

      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={62} minSize={35}>
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              <WaitpointPanel run={run} onRunUpdated={onRunUpdated} />
              <RunTimeline
                run={run}
                selectedSpanId={selectedSpanId}
                onSelectSpan={(span) => setSelectedSpanId(span.id)}
              />
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={38} minSize={25}>
          <SpanDetailPane
            span={selectedSpan}
            run={run}
            showCloseButton={selectedSpanId !== "run"}
            onClose={closeDetail}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

type ReplayState =
  | { kind: "idle" }
  | { kind: "in-flight" }
  | { kind: "error"; message: string }
  | { kind: "done"; newRunId: string }

function DetailHeader({
  run,
  replay,
  onReplay,
}: {
  run: StoredRun
  replay: ReplayState
  onReplay: () => void
}): React.ReactElement {
  return (
    <header className="border-border flex h-12 shrink-0 items-center gap-3 border-b px-4">
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink className="font-mono">{run.workflowId}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono">{run.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <StatusBadge status={run.status} className="ml-1" />

      {run.replayOf && (
        <span
          className="text-muted-foreground inline-flex items-center gap-1 text-[11px]"
          title={`Replayed from ${run.replayOf}`}
        >
          <History className="size-3" />
          replay of <code className="font-mono">{run.replayOf}</code>
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {replay.kind === "done" && (
          <span className="text-xs text-emerald-500">
            created <code className="font-mono">{replay.newRunId}</code>
          </span>
        )}
        {replay.kind === "error" && (
          <span className="text-destructive text-xs" title={replay.message}>
            replay failed
          </span>
        )}
        <Separator orientation="vertical" className="h-5" />
        <Button
          variant="outline"
          size="sm"
          onClick={onReplay}
          disabled={replay.kind === "in-flight"}
          title="Replay this run (R)"
        >
          <RotateCcw className="size-3.5" />
          {replay.kind === "in-flight" ? "Replaying…" : "Replay"}
          <Kbd className="ml-1 text-[10px]">R</Kbd>
        </Button>
      </div>
    </header>
  )
}

/** True if the target is an editable element that should swallow hotkeys. */
function isEditable(el: HTMLElement): boolean {
  if (el.isContentEditable) return true
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}
