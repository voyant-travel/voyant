import { createRoute, Outlet } from "@tanstack/react-router"
import {
  type AdminBootstrapStatus,
  attachAdminExtensionRoutes,
  buildAdminExtensionRoutes,
  createAdminRouter,
  type ManagedProfileAdminAuthRuntime,
} from "@voyant-travel/admin/app"
import {
  AdminWorkspacePendingFallback,
  AdminWorkspaceShell,
  createAdminWorkspaceBeforeLoad,
} from "@voyant-travel/admin/app/workspace"
import { createAdminCoreExtension } from "@voyant-travel/admin-app/core-extension"
import {
  getManagedProfileAdminApiUrl,
  managedProfileAdminFetcher,
} from "@voyant-travel/admin-app/runtime"
import { UserProvider, useUser } from "@voyant-travel/admin-react/user"

import { Route as rootRoute } from "./routes/__root"
import { routeTree } from "./routeTree.gen"

/**
 * The SOURCE-FREE code-based router (packaged-admin RFC §4.8 endgame).
 *
 * The ONLY route FILE is `src/routes/__root.tsx`; TanStack Start's generator
 * emits `routeTree.gen.ts` containing just `__root`. Everything below the root —
 * the `_workspace` auth-guarded layout and every admin page — is built HERE in
 * code from packaged extension factories, then grafted onto the tree. No
 * `(auth)` suite, no `_workspace/route.tsx`, no domain page files exist.
 */

// The loaded-user shape this reference resolves — a structural superset of the
// packaged workspace-shell user (the stub API returns this from `/api/auth/me`).
interface ManagedUser {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  locale?: string | null
  timeZone?: string | null
}

/**
 * The deployment's auth capability port. Auth is deployment-owned, so the
 * packaged admin (shell, guard) depends only on this port — never a concrete
 * auth client. Here it fetches the stub `/api/auth/*` surface via the packaged
 * managed-profile fetcher (cookie-forwarding, SSR-aware).
 */
const managedAuthRuntime: ManagedProfileAdminAuthRuntime<ManagedUser> = {
  getCurrentUser: async () => {
    const response = await managedProfileAdminFetcher(`${getManagedProfileAdminApiUrl()}/auth/me`)
    if (!response.ok) return null
    return (await response.json()) as ManagedUser
  },
  getBootstrapStatus: async () => {
    const response = await managedProfileAdminFetcher(
      `${getManagedProfileAdminApiUrl()}/auth/bootstrap-status`,
    )
    if (!response.ok) return { hasUsers: true } satisfies AdminBootstrapStatus
    return (await response.json()) as AdminBootstrapStatus
  },
  cloudAuthStartHref: (next?: string) =>
    `/api/auth/cloud/start${next ? `?next=${encodeURIComponent(next)}` : ""}`,
  signOut: async () => {},
}

// CORE extension only for this vertical slice: the dashboard, account, and
// settings pages every Voyant admin ships. Domain extensions come later.
const extensions = [createAdminCoreExtension()]

const workspaceGuard = createAdminWorkspaceBeforeLoad({ auth: managedAuthRuntime })

// The `_workspace` auth-guarded layout — built in CODE (no route file). Mirrors
// what `src/routes/_workspace/route.tsx` would declare in a file-routed host.
const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_workspace",
  ssr: "data-only",
  beforeLoad: ({ location }) => workspaceGuard({ location }),
  loader: ({ context }) => ({ user: (context as { user: ManagedUser }).user }),
  pendingComponent: AdminWorkspacePendingFallback,
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { user } = workspaceRoute.useLoaderData()

  return (
    <UserProvider getCurrentUser={managedAuthRuntime.getCurrentUser} initialUser={user}>
      <WorkspaceContent />
    </UserProvider>
  )
}

function WorkspaceContent() {
  const { user, isLoading } = useUser<ManagedUser>()

  return (
    <AdminWorkspaceShell
      user={user}
      isUserLoading={isLoading}
      extensions={extensions}
      onSignOut={() => managedAuthRuntime.signOut()}
    >
      <Outlet />
    </AdminWorkspaceShell>
  )
}

// Add the code-built workspace layout as a child of root FIRST, so
// `attachAdminExtensionRoutes` can graft the extension routes under it (it reads
// `workspaceRoute.children`).
rootRoute.addChildren([workspaceRoute])

// Build the packaged extension page routes (code-based `createRoute(...)` per
// contribution) under the workspace layout, then graft them.
const runtime = { baseUrl: getManagedProfileAdminApiUrl(), fetcher: managedProfileAdminFetcher }
const extRoutes = buildAdminExtensionRoutes(extensions, () => workspaceRoute, runtime)
const tree = attachAdminExtensionRoutes(routeTree, workspaceRoute, extRoutes)

export function getRouter() {
  return createAdminRouter({ routeTree: tree })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
