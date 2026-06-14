import { Badge } from "@voyant-travel/ui/components/badge"
import { cn } from "@voyant-travel/ui/lib/utils"

// Tailwind utility classes keyed by run-status. Keeps the status tone
// consistent wherever it's rendered (runs table, detail header,
// timeline bar highlights).
const TONES: Record<string, string> = {
  completed:
    "bg-emerald-500/15 text-emerald-500 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300",
  running:
    "bg-sky-500/15 text-sky-500 border-sky-500/30 animate-pulse dark:bg-sky-500/20 dark:text-sky-300",
  waiting:
    "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",
  failed: "bg-red-500/15 text-red-600 border-red-500/30 dark:bg-red-500/20 dark:text-red-300",
  cancelled:
    "bg-zinc-500/15 text-zinc-500 border-zinc-500/30 dark:bg-zinc-500/20 dark:text-zinc-300",
  compensated:
    "bg-violet-500/15 text-violet-500 border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-300",
  compensation_failed:
    "bg-red-500/15 text-red-600 border-red-500/30 dark:bg-red-500/20 dark:text-red-300",
  timed_out:
    "bg-orange-500/15 text-orange-500 border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300",
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}): React.ReactElement {
  const tone = TONES[status] ?? "bg-muted text-muted-foreground border-border"
  const label = status.replace(/_/g, " ")
  return (
    <Badge variant="outline" className={cn(tone, "font-medium capitalize", className)}>
      {label}
    </Badge>
  )
}
