import { createFileRoute, Outlet } from "@tanstack/react-router"
import type { OperatorAdminNavigationIcons } from "@voyantjs/admin"
import {
  AdminWorkspacePendingFallback,
  AdminWorkspaceShell,
  createAdminWorkspaceBeforeLoad,
} from "@voyantjs/admin-app"
import {
  Building,
  Building2,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  LayoutDashboard,
  Library,
  Mail,
  Package,
  Plane,
  Radio,
  Scale,
  Settings,
  Users,
  Wrench,
} from "lucide-react"
import { UserProvider, useUser } from "@/components/providers/user-provider"
import { createOperatorAdminExtensions } from "@/lib/admin-extensions"
import { useSignOut } from "@/lib/auth"
import { getCurrentUser } from "@/lib/current-user"

const operatorNavigationIcons = {
  availability: CalendarDays,
  bookings: CalendarCheck,
  catalog: Library,
  channelSync: Radio,
  dashboard: LayoutDashboard,
  finance: DollarSign,
  flights: Plane,
  legal: Scale,
  notifications: Mail,
  organizations: Building,
  people: Users,
  products: Package,
  resources: Wrench,
  settings: Settings,
  suppliers: Building2,
} satisfies OperatorAdminNavigationIcons

const workspaceGuard = createAdminWorkspaceBeforeLoad({ getCurrentUser })

export const Route = createFileRoute("/_workspace")({
  // Parent loader runs server-side (auth check + user fetch through cookie-
  // forwarding server fn). Component still renders on the client because
  // the workspace chrome reads localStorage (theme, locale) — keeping that
  // client-only avoids hydration mismatches.
  ssr: "data-only",
  // Inline wrapper so TanStack infers the `{ user }` context merge from the
  // packaged guard's return type.
  beforeLoad: ({ location }) => workspaceGuard({ location }),
  loader: ({ context }) => ({ user: context.user }),
  pendingComponent: AdminWorkspacePendingFallback,
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { user } = Route.useLoaderData()

  return (
    <UserProvider initialUser={user}>
      <WorkspaceContent />
    </UserProvider>
  )
}

function WorkspaceContent() {
  const { user, isLoading } = useUser()
  const signOut = useSignOut()

  return (
    <AdminWorkspaceShell
      user={user}
      isUserLoading={isLoading}
      icons={operatorNavigationIcons}
      extensions={(messages) =>
        createOperatorAdminExtensions({
          actionLedger: messages.nav.actionLedger,
          allTrips: messages.nav.allTrips,
          newTrip: messages.nav.newTrip,
          promotions: messages.nav.promotions,
          trips: messages.nav.trips,
        })
      }
      onSignOut={() => signOut({ redirectTo: "/sign-in" })}
    >
      <Outlet />
    </AdminWorkspaceShell>
  )
}
