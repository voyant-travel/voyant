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
import { operatorAdminDestinations } from "@/lib/admin-destinations"
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
          bookings: messages.nav.bookings,
          catalogAccommodations: messages.nav.catalogAccommodations,
          catalogCruises: messages.nav.catalogCruises,
          catalogExcursions: messages.nav.catalogExcursions,
          catalogProducts: messages.nav.catalogProducts,
          catalogTours: messages.nav.catalogTours,
          contractNumberSeries: messages.nav.contractNumberSeries,
          contractTemplates: messages.nav.contractTemplates,
          contracts: messages.nav.contracts,
          invoiceNumberSeries: messages.nav.invoiceNumberSeries,
          invoices: messages.nav.invoices,
          newTrip: messages.nav.newTrip,
          organizations: messages.nav.organizations,
          payments: messages.nav.payments,
          people: messages.nav.people,
          policies: messages.nav.policies,
          profitability: messages.nav.profitability,
          promotions: messages.nav.promotions,
          supplierInvoices: messages.nav.supplierInvoices,
          suppliers: messages.nav.suppliers,
          trips: messages.nav.trips,
        })
      }
      destinations={operatorAdminDestinations}
      onSignOut={() => signOut({ redirectTo: "/sign-in" })}
    >
      <Outlet />
    </AdminWorkspaceShell>
  )
}
