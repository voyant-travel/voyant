// Compact "Triggered → Started → Finished" timeline milestones for
// the Overview tab. Each row is an event tick with an absolute time
// and a relative delta from the prior tick.

import { cn } from "@voyant-travel/ui/lib/utils"
import { formatDuration, formatTime } from "@/lib/utils"

export interface Milestone {
  label: string
  at: number | undefined
  tone?: "pending" | "ok" | "err"
}

export function SpanMilestones({
  milestones,
}: {
  milestones: readonly Milestone[]
}): React.ReactElement {
  // Carry the most recent known time forward so we can compute deltas
  // across rows that don't yet have their own timestamp (still-pending).
  let prev: number | undefined

  return (
    <ol className="space-y-0">
      {milestones.map((m, i) => {
        const last = i === milestones.length - 1
        const delta = m.at !== undefined && prev !== undefined ? m.at - prev : undefined
        if (m.at !== undefined) prev = m.at
        return (
          <li key={m.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "size-2 rounded-full",
                  m.at === undefined
                    ? "border-border bg-background border-2"
                    : m.tone === "err"
                      ? "bg-red-500"
                      : m.tone === "pending"
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                )}
              />
              {!last && <span className="bg-border w-px flex-1" />}
            </div>
            <div className="pb-3 last:pb-0">
              <div className="text-xs font-medium">{m.label}</div>
              <div className="text-muted-foreground mt-0.5 font-mono text-[10px] tabular-nums">
                {m.at !== undefined ? (
                  <>
                    {formatTime(m.at)}
                    {delta !== undefined && delta > 0 && (
                      <span className="ml-2">+{formatDuration(delta)}</span>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
