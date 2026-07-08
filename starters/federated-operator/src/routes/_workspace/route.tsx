import { createFileRoute, Outlet, useRouter, useRouterState } from "@tanstack/react-router"
import {
  AdminWorkspacePendingFallback,
  createAdminWorkspaceBeforeLoad,
} from "@voyant-travel/admin/app/workspace"
import { OperatorAdminBootstrapGate } from "@voyant-travel/admin/components/operator-admin-bootstrap-gate"
import { OperatorAdminWorkspaceLayout } from "@voyant-travel/admin/components/operator-admin-sidebar"
import { AdminNavigationProvider } from "@voyant-travel/admin/navigation/destinations"
import { UserProvider, useUser } from "@/components/providers/user-provider"
import { adminAuthRuntime } from "@/lib/admin-auth-runtime"
import { federatedAdminDestinations } from "@/lib/admin-destinations"
import {
  createFederatedAdminExtensions,
  federatedAdminIcons,
  federatedBaseNav,
} from "@/lib/admin-extensions"
import { useSignOut } from "@/lib/auth"
import type { CurrentUser } from "@/lib/current-user"

const workspaceGuard = createAdminWorkspaceBeforeLoad({ auth: adminAuthRuntime })
const federatedAdminExtensions = createFederatedAdminExtensions()

export const Route = createFileRoute("/_workspace")({
  ssr: "data-only",
  beforeLoad: ({ location }) => workspaceGuard({ location }),
  loader: ({ context }) => ({ user: context.user }),
  pendingComponent: AdminWorkspacePendingFallback,
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { user } = Route.useLoaderData() as { user: CurrentUser }

  return (
    <UserProvider initialUser={user}>
      <WorkspaceContent />
    </UserProvider>
  )
}

function WorkspaceContent() {
  const { user, isLoading } = useUser()
  const signOut = useSignOut()
  const router = useRouter()
  const currentPath = useRouterState({ select: (s) => s.location.pathname })

  return (
    <OperatorAdminBootstrapGate
      user={user}
      isUserLoading={isLoading}
      loadingFallback={<AdminWorkspacePendingFallback />}
    >
      {({ user: loadedUser }) => (
        <AdminNavigationProvider
          resolvers={federatedAdminDestinations}
          navigate={(href, options) => {
            void router.navigate({ href, replace: options?.replace })
          }}
        >
          <OperatorAdminWorkspaceLayout
            accountHref="/settings"
            currentPath={currentPath}
            extensions={federatedAdminExtensions}
            icons={federatedAdminIcons}
            navItems={federatedBaseNav}
            onSignOut={() => signOut({ redirectTo: "/sign-in" })}
            user={{
              id: loadedUser.id,
              email: loadedUser.email,
              firstName: loadedUser.firstName,
              lastName: loadedUser.lastName,
              locale: loadedUser.locale,
              timeZone: loadedUser.timezone,
              avatar: loadedUser.profilePictureUrl,
            }}
          >
            <Outlet />
          </OperatorAdminWorkspaceLayout>
        </AdminNavigationProvider>
      )}
    </OperatorAdminBootstrapGate>
  )
}
