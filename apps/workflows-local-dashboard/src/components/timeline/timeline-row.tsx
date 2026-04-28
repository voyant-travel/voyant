// One row in the Gantt tree. Left column has an icon + label; right
// column has a horizontal bar or dot positioned via percentages from
// the shared `Scale`.

import { cn } from "@voyantjs/ui/lib/utils"
import {
  Clock,
  Code2,
  FileText,
  GitBranch,
  type LucideIcon,
  RotateCcw,
  Terminal,
  Waves,
  Zap,
} from "lucide-react"

import { formatDuration } from "@/lib/utils"
import { TIMELINE_GRID } from "./run-timeline"
import type { Scale } from "./timeline-scale"
import type { Span, SpanKind, SpanStatus } from "./timeline-types"

const ICON: Record<SpanKind, LucideIcon> = {
  run: Zap,
  step: Code2,
  waitpoint: Clock,
  log: FileText,
  stream: Waves,
  compensation: RotateCcw,
}

export function TimelineRow({
  span,
  scale,
  now,
  selected,
  onSelect,
  depth = 0,
}: {
  span: Span
  scale: Scale
  now: number
  selected: boolean
  onSelect: (span: Span) => void
  depth?: number
}): React.ReactElement {
  const endAt = span.endAt ?? now
  const duration = endAt - span.at
  const inFlight = span.endAt === undefined

  const { left, width } = scale.spanPercent(span.at, endAt)
  const isInstant = span.at === span.endAt || span.kind === "log" || span.kind === "stream"

  const Icon = ICON[span.kind]

  return (
    <button
      type="button"
      onClick={() => onSelect(span)}
      className={cn(
        "hover:bg-muted/40 group grid w-full items-center border-b border-border/60 text-left",
        TIMELINE_GRID,
        selected && "bg-muted/70",
      )}
    >
      <div
        className="flex min-w-0 items-center gap-2 px-3 py-1.5"
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        <Icon className={cn("size-3.5 shrink-0", iconTone(span.kind, span.status, inFlight))} />
        <span className="truncate font-mono text-xs">{span.label}</span>
        {span.sublabel && (
          <span className="text-muted-foreground shrink-0 text-[10px]">{span.sublabel}</span>
        )}
      </div>

      <div className="relative h-6">
        {isInstant ? (
          <Dot left={left} tone={barTone(span.kind, span.status)} />
        ) : (
          <Bar left={left} width={width} tone={barTone(span.kind, span.status)} pulse={inFlight} />
        )}
      </div>

      <div className="text-muted-foreground pr-3 text-right font-mono text-[11px] tabular-nums">
        {isInstant ? "·" : inFlight ? `${formatDuration(duration)} …` : formatDuration(duration)}
      </div>
    </button>
  )
}

function Bar({
  left,
  width,
  tone,
  pulse,
}: {
  left: number
  width: number
  tone: string
  pulse: boolean
}): React.ReactElement {
  return (
    <div
      className={cn(
        "absolute top-1/2 h-2 -translate-y-1/2 rounded-sm",
        tone,
        pulse && "animate-pulse",
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
    />
  )
}

function Dot({ left, tone }: { left: number; tone: string }): React.ReactElement {
  return (
    <div
      className={cn(
        "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2",
        tone.replace(/bg-/g, "bg-").replace(/\/\d+/g, ""),
        "ring-background",
      )}
      style={{ left: `${left}%` }}
    />
  )
}

function barTone(kind: SpanKind, status: SpanStatus): string {
  if (status === "err") return "bg-red-500"
  if (kind === "run") {
    if (status === "ok") return "bg-emerald-500"
    if (status === "cancelled") return "bg-zinc-500"
    return "bg-sky-500"
  }
  if (kind === "step") return status === "ok" ? "bg-emerald-500" : "bg-sky-500"
  if (kind === "waitpoint") {
    if (status === "resolved") return "bg-violet-500"
    return "bg-amber-500"
  }
  if (kind === "compensation") return status === "ok" ? "bg-violet-400" : "bg-red-500"
  if (kind === "log") return "bg-zinc-400"
  if (kind === "stream") return "bg-cyan-400"
  return "bg-muted-foreground"
}

function iconTone(kind: SpanKind, status: SpanStatus, inFlight: boolean): string {
  if (status === "err") return "text-red-500"
  if (inFlight) return "text-sky-500"
  if (kind === "waitpoint") return status === "resolved" ? "text-violet-500" : "text-amber-500"
  if (kind === "log") return "text-muted-foreground"
  if (kind === "stream") return "text-cyan-500"
  if (kind === "compensation") return "text-violet-500"
  if (status === "ok") return "text-emerald-500"
  return "text-muted-foreground"
}

export { GitBranch, Terminal }
