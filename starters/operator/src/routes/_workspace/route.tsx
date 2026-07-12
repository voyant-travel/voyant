import { createFileRoute, Outlet } from "@tanstack/react-router"
import { defaultOperatorNavIcons } from "@voyant-travel/admin"
import {
  AdminWorkspacePendingFallback,
  AdminWorkspaceShell,
  createAdminWorkspaceBeforeLoad,
} from "@voyant-travel/admin/app/workspace"
import { RealtimeChannel } from "@voyant-travel/cloud-sdk"
import { AdminWorkspaceRealtimeProvider } from "@voyant-travel/realtime-react"
import { UserProvider, useUser } from "@/components/providers/user-provider"
import { adminAuthRuntime } from "@/lib/admin-auth-runtime"
import { operatorAdminDestinations } from "@/lib/admin-destinations"
import { operatorAdminPresentation } from "@/lib/admin-presentation"
import { authClient, useSignOut } from "@/lib/auth"
import { getApiUrl } from "@/lib/env"
import { projectFetcher } from "@/lib/voyant-fetcher"

// The standard nav icon set ships from @voyant-travel/admin. Override a single
// entry with `{ ...defaultOperatorNavIcons, finance: MyIcon }` if needed.
const operatorNavigationIcons = defaultOperatorNavIcons

const workspaceGuard = createAdminWorkspaceBeforeLoad({ auth: adminAuthRuntime })

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

export function WorkspaceLayout() {
  const { user } = Route.useLoaderData()

  return (
    <UserProvider initialUser={user}>
      <AdminWorkspaceRealtimeProvider
        fetcher={projectFetcher}
        getApiUrl={getApiUrl}
        realtimeChannel={RealtimeChannel}
        useSession={authClient.useSession}
      >
        <WorkspaceContent />
      </AdminWorkspaceRealtimeProvider>
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
      // The extension builder picks the nav label keys it needs from the full
      // nav messages — no hand-listing each key here.
      extensions={(messages) => operatorAdminPresentation.createExtensions(messages.nav)}
      destinations={operatorAdminDestinations}
      onSignOut={() => signOut({ redirectTo: "/sign-in" })}
    >
      <Outlet />
    </AdminWorkspaceShell>
  )
}
