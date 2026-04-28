import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router"
import { cn } from "@voyantjs/ui/lib/utils"
import {
  CalendarClock,
  FolderKanban,
  Layers,
  Settings as SettingsIcon,
  Users,
  XCircle,
} from "lucide-react"

export const Route = createFileRoute("/_workspace/settings")({
  component: SettingsLayout,
})

const GENERAL_NAV = [{ title: "Team", url: "/settings/team", icon: Users }] as const

const PRICING_NAV = [
  { title: "Price Catalogs", url: "/settings/pricing/catalogs", icon: FolderKanban },
  { title: "Pricing Categories", url: "/settings/pricing/categories", icon: Layers },
  {
    title: "Cancellation Policies",
    url: "/settings/pricing/cancellation-policies",
    icon: XCircle,
  },
  { title: "Price Schedules", url: "/settings/pricing/schedules", icon: CalendarClock },
] as const

function SettingsLayout() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="flex gap-8">
        <aside className="w-56 shrink-0">
          <div className="flex flex-col gap-1">
            <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              General
            </p>
            {GENERAL_NAV.map((item) => {
              const isActive = currentPath.startsWith(item.url)
              return (
                <Link
                  key={item.url}
                  to={item.url}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              )
            })}
            <p className="mt-4 px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pricing
            </p>
            {PRICING_NAV.map((item) => {
              const isActive = currentPath.startsWith(item.url)
              return (
                <Link
                  key={item.url}
                  to={item.url}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              )
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
