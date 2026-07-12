import { createFileRoute, Outlet } from "@tanstack/react-router"
import { createAdminHostWorkspace } from "@voyant-travel/admin-host/workspace"
import { RealtimeChannel } from "@voyant-travel/cloud-sdk"
import { AdminWorkspaceRealtimeProvider } from "@voyant-travel/realtime-react"
import { adminAuthRuntime } from "@/lib/admin-auth-runtime"
import { operatorAdminPresentation } from "@/lib/admin-presentation"
import { authClient } from "@/lib/auth"
import { getApiUrl } from "@/lib/env"
import { projectFetcher } from "@/lib/voyant-fetcher"

const workspace = createAdminHostWorkspace({
  auth: adminAuthRuntime,
  presentation: operatorAdminPresentation,
  api: { getBaseUrl: getApiUrl, fetcher: projectFetcher },
  realtime: {
    Provider: AdminWorkspaceRealtimeProvider,
    channel: RealtimeChannel,
    useSession: authClient.useSession,
  },
})

export const Route = createFileRoute("/_workspace")({
  // Parent loader runs server-side (auth check + user fetch through cookie-
  // forwarding server fn). Component still renders on the client because
  // the workspace chrome reads localStorage (theme, locale) — keeping that
  // client-only avoids hydration mismatches.
  ssr: "data-only",
  // Inline wrapper so TanStack infers the `{ user }` context merge from the
  // packaged guard's return type.
  beforeLoad: ({ location }) => workspace.beforeLoad({ location }),
  loader: ({ context }) => ({ user: context.user }),
  pendingComponent: workspace.PendingComponent,
  component: WorkspaceLayout,
})

export function WorkspaceLayout() {
  const { user } = Route.useLoaderData()

  return (
    <workspace.Workspace initialUser={user}>
      <Outlet />
    </workspace.Workspace>
  )
}
