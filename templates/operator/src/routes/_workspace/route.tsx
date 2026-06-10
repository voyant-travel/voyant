import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router"
import {
  AdminLocalePreferenceSync,
  type AdminNavLinkProps,
  OperatorAdminBootstrapGate,
  type OperatorAdminNavigationIcons,
  OperatorAdminWorkspaceLayout,
} from "@voyantjs/admin"
import {
  Building,
  Building2,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  FileText,
  LayoutDashboard,
  Library,
  Loader2,
  Mail,
  Package,
  Plane,
  Radio,
  Scale,
  Settings,
  Users,
  Wrench,
} from "lucide-react"
import { forwardRef, useMemo } from "react"
import { UserProvider, useUser } from "@/components/providers/user-provider"
import { createOperatorAdminExtensions } from "@/lib/admin-extensions"
import {
  AdminI18nProvider,
  getAdminMessageOverridesFromUiPrefs,
  useAdminMessages,
} from "@/lib/admin-i18n"
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
  quotes: FileText,
  resources: Wrench,
  settings: Settings,
  suppliers: Building2,
} satisfies OperatorAdminNavigationIcons

// SidebarMenuButton with `asChild` wraps this in a Radix Slot, which clones
// the element with merged className/data-*/event props. We must forward those
// extras to the rendered element — AdminNavLinkProps doesn't declare them but
// they arrive at runtime, so spread the rest. Without this, Slot's className
// (e.g. `peer/menu-button flex w-full items-center gap-2 …`) is silently
// dropped and the sidebar items render unstyled.
const AdminRouterLink = forwardRef<HTMLAnchorElement, AdminNavLinkProps>(function AdminRouterLink(
  { children, href, onClick, target, ...rest },
  ref,
) {
  const external = href.startsWith("http://") || href.startsWith("https://")

  if (external) {
    return (
      <a
        ref={ref}
        href={href}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        onClick={onClick}
        {...rest}
      >
        {children}
      </a>
    )
  }

  return (
    <Link ref={ref} to={href} target={target} onClick={onClick} {...rest}>
      {children}
    </Link>
  )
})

export const Route = createFileRoute("/_workspace")({
  // Parent loader runs server-side (auth check + user fetch through cookie-
  // forwarding server fn). Component still renders on the client because
  // the workspace chrome reads localStorage (theme, locale) — keeping that
  // client-only avoids hydration mismatches.
  ssr: "data-only",
  loader: async ({ location }) => {
    const user = await getCurrentUser()

    if (!user) {
      throw redirect({
        to: "/sign-in",
        search: { next: location.href },
      })
    }

    return { user }
  },
  pendingComponent: WorkspacePendingFallback,
  component: WorkspaceLayout,
})

function WorkspacePendingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  )
}

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
  const messages = useAdminMessages()

  return (
    <OperatorAdminBootstrapGate
      user={user}
      isUserLoading={isLoading}
      loadingFallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{messages.loading}</p>
          </div>
        </div>
      }
    >
      {({ user }) => (
        <AdminI18nProvider overrides={getAdminMessageOverridesFromUiPrefs(user.uiPrefs)}>
          <AdminLocalePreferenceSync source={user} />
          <WorkspaceInner user={user} />
        </AdminI18nProvider>
      )}
    </OperatorAdminBootstrapGate>
  )
}

function WorkspaceInner({ user }: { user: NonNullable<ReturnType<typeof useUser>["user"]> }) {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ")
  const currentPath = useRouterState({ select: (s) => s.location.pathname })
  const messages = useAdminMessages()
  const signOut = useSignOut()
  const adminExtensions = useMemo(
    () =>
      createOperatorAdminExtensions({
        actionLedger: messages.nav.actionLedger,
        allTrips: messages.nav.allTrips,
        newTrip: messages.nav.newTrip,
        promotions: messages.nav.promotions,
        trips: messages.nav.trips,
      }),
    [
      messages.nav.actionLedger,
      messages.nav.allTrips,
      messages.nav.newTrip,
      messages.nav.promotions,
      messages.nav.trips,
    ],
  )

  return (
    <OperatorAdminWorkspaceLayout
      currentPath={currentPath}
      extensions={adminExtensions}
      icons={operatorNavigationIcons}
      linkComponent={AdminRouterLink}
      onSignOut={() => signOut({ redirectTo: "/sign-in" })}
      user={{
        name: displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email ?? undefined,
        avatar: user.profilePictureUrl,
        locale: user.locale,
        timeZone: user.timezone,
      }}
    >
      <Outlet />
    </OperatorAdminWorkspaceLayout>
  )
}
