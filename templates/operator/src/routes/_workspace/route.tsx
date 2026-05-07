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
import { UserProvider, useUser } from "@/components/providers/user-provider"
import { adminExtensions } from "@/lib/admin-extensions"
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
  resources: Wrench,
  settings: Settings,
  suppliers: Building2,
} satisfies OperatorAdminNavigationIcons

function AdminRouterLink({ children, href, onClick, target }: AdminNavLinkProps) {
  const external = href.startsWith("http://") || href.startsWith("https://")

  if (external) {
    return (
      <a
        href={href}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        onClick={onClick}
      >
        {children}
      </a>
    )
  }

  return (
    <Link to={href} target={target} onClick={onClick}>
      {children}
    </Link>
  )
}

export const Route = createFileRoute("/_workspace")({
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
  // Minimal SSR fallback. Rendered for the first paint because `defaultSsr: false`
  // (src/start.ts) turns off server-side loader/component execution for the whole
  // auth-gated app. Once the client hydrates, each child route's own pendingComponent
  // takes over while its loader runs.
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
  const signOut = useSignOut()

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
