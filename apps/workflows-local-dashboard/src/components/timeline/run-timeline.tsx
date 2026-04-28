// Gantt-style run tree. Renders a timeline header + one row per span,
// with bars / dots positioned by a shared `Scale` derived from the
// run's `startedAt` → `completedAt` window.
//
// In-flight runs animate: `now` is refreshed on a 250ms interval so
// open spans visually extend. A live-run root span has no `endAt`, so
// we clamp the scale to `now`.

import { cn } from "@voyantjs/ui/lib/utils"
import { useEffect, useMemo, useState } from "react"

import type { StoredRun } from "@/lib/api"
import { TimelineHeader } from "./timeline-header"
import { TimelineRow } from "./timeline-row"
import { createScale } from "./timeline-scale"
import { buildRootSpan, buildSpans } from "./timeline-spans"
import type { Span } from "./timeline-types"

const TICK_INTERVAL_MS = 250

// Shared grid template used by both the header and each row, so the
// label column, bar column, and duration column line up exactly.
export const TIMELINE_GRID = "grid-cols-[minmax(220px,_28%)_1fr_72px]"

export function RunTimeline({
  run,
  selectedSpanId,
  onSelectSpan,
  className,
}: {
  run: StoredRun
  selectedSpanId: string | undefined
  onSelectSpan: (span: Span) => void
  className?: string
}): React.ReactElement {
  const terminal = run.completedAt !== undefined
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    if (terminal) return
    const t = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS)
    return () => clearInterval(t)
  }, [terminal])

  const { rootSpan, spans, scale } = useMemo(() => {
    const root = buildRootSpan(run, now)
    const inner = buildSpans(run)
    const endAt = root.endAt ?? now
    return {
      rootSpan: root,
      spans: inner,
      scale: createScale(run.startedAt, Math.max(endAt, run.startedAt + 1)),
    }
  }, [run, now])

  return (
    <div className={cn("border-border rounded-md border", className)}>
      <div className={cn("grid", TIMELINE_GRID)}>
        <div className="border-border text-muted-foreground border-b border-r px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide">
          Span
        </div>
        <TimelineHeader scale={scale} />
        <div className="border-border text-muted-foreground border-b border-l px-3 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide">
          Duration
        </div>
      </div>

      <TimelineRow
        span={rootSpan}
        scale={scale}
        now={now}
        selected={selectedSpanId === rootSpan.id}
        onSelect={onSelectSpan}
      />

      {spans.map((span) => (
        <TimelineRow
          key={span.id}
          span={span}
          scale={scale}
          now={now}
          selected={selectedSpanId === span.id}
          onSelect={onSelectSpan}
          depth={1}
        />
      ))}

      {spans.length === 0 && (
        <div className="text-muted-foreground py-8 text-center text-xs">No steps yet.</div>
      )}
    </div>
  )
}

export type { Span } from "./timeline-types"
