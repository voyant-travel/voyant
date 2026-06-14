import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import { Kbd } from "@voyant-travel/ui/components/kbd"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Plus, Radio, Zap } from "lucide-react"

export function AppHeader({
  runCount,
  live,
  canTrigger,
  onNewRun,
}: {
  runCount: number
  live: boolean
  canTrigger: boolean
  onNewRun: () => void
}): React.ReactElement {
  return (
    <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 backdrop-blur sm:h-14 sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-0">
      <div className="flex min-w-0 items-center gap-2">
        <Zap className="size-5 shrink-0 text-primary" />
        <span className="truncate text-sm font-semibold tracking-tight">Voyant Workflows</span>
        <Badge variant="secondary" className="font-mono text-[10px] uppercase">
          local
        </Badge>
      </div>

      <LiveIndicator connected={live} />

      <div className="ml-auto flex items-center gap-3">
        <span className="text-muted-foreground hidden font-mono text-xs tabular-nums sm:inline">
          {runCount} run{runCount === 1 ? "" : "s"}
        </span>
        <Button
          size="sm"
          onClick={onNewRun}
          disabled={!canTrigger}
          title={
            canTrigger
              ? "Trigger a new run (N)"
              : "Start `voyant serve` with --file to enable triggering"
          }
        >
          <Plus className="size-3.5" />
          New run
          {canTrigger && <Kbd className="ml-1 text-[10px]">N</Kbd>}
        </Button>
      </div>
    </header>
  )
}

function LiveIndicator({ connected }: { connected: boolean }): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        connected ? "text-emerald-500" : "text-muted-foreground",
      )}
      title={connected ? "Connected to the live stream" : "Reconnecting…"}
    >
      <Radio
        className={cn("size-3", connected ? "animate-pulse text-emerald-500" : "text-amber-500")}
      />
      {connected ? "live" : "offline"}
    </span>
  )
}
