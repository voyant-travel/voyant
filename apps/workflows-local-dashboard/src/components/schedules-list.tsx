// Compact list of the workflow schedules declared by the loaded
// entry file. Empty = no declared schedules.

import { Badge } from "@voyantjs/ui/components/badge"
import { Timer } from "lucide-react"

import type { ScheduleSummary } from "@/lib/api"
import { formatRelative } from "@/lib/utils"

export function SchedulesList({
  schedules,
}: {
  schedules: ScheduleSummary[]
}): React.ReactElement | null {
  if (schedules.length === 0) return null
  const now = Date.now()
  return (
    <div className="border-border border-t">
      <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-[11px] font-medium uppercase tracking-wide">
        <Timer className="size-3" />
        Schedules
        <span className="ml-auto">{schedules.length}</span>
      </div>
      <div className="space-y-px pb-2">
        {schedules.map((s) => (
          <div
            key={`${s.workflowId}:${s.name ?? ""}:${s.nextAt}`}
            className="hover:bg-muted/60 flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
          >
            <div className="flex items-center gap-2 truncate">
              <code className="truncate font-mono">{s.workflowId}</code>
              {s.name && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {s.name}
                </Badge>
              )}
            </div>
            <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
              {s.done ? "done" : formatRelative(s.nextAt - now)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
