// Left-hand navigation. Icon + label per item. Click switches the
// top-level route ("workflows" | "runs"); the main content area
// swaps. Matches the Trigger.dev style of a persistent, low-chrome
// left rail scoped to the current session.

import { Button } from "@voyant-travel/ui/components/button"
import { cn } from "@voyant-travel/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import { ListTree, Workflow } from "lucide-react"

export type Route = "workflows" | "runs"

interface NavItem {
  route: Route
  label: string
  icon: LucideIcon
}

const ITEMS: readonly NavItem[] = [
  { route: "workflows", label: "Workflows", icon: Workflow },
  { route: "runs", label: "Runs", icon: ListTree },
]

export function AppSidebar({
  route,
  onChange,
}: {
  route: Route
  onChange: (route: Route) => void
}): React.ReactElement {
  return (
    <aside className="border-border bg-background/60 flex shrink-0 gap-0.5 border-b p-2 sm:w-44 sm:flex-col sm:border-r sm:border-b-0">
      {ITEMS.map((item) => {
        const Icon = item.icon
        const active = route === item.route
        return (
          <Button
            key={item.route}
            variant="ghost"
            size="sm"
            className={cn(
              "min-w-0 flex-1 justify-start gap-2 font-normal sm:flex-none",
              active && "bg-muted text-foreground",
            )}
            onClick={() => onChange(item.route)}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Button>
        )
      })}
    </aside>
  )
}
