import { createRoute, Outlet } from "@tanstack/react-router"
import {
  type AdminBootstrapStatus,
  attachAdminExtensionRoutes,
  buildAdminExtensionDestinations,
  buildAdminExtensionRoutes,
  createAdminRouter,
  type ManagedProfileAdminAuthRuntime,
} from "@voyant-travel/admin/app"
import {
  AdminWorkspacePendingFallback,
  AdminWorkspaceShell,
  createAdminWorkspaceBeforeLoad,
} from "@voyant-travel/admin/app/workspace"
import {
  getManagedProfileAdminApiUrl,
  managedProfileAdminFetcher,
} from "@voyant-travel/admin-app/runtime"
import { UserProvider, useUser } from "@voyant-travel/admin-react/user"
import { useMemo } from "react"

import { createManagedAdminExtensions } from "./managed-admin-extensions"
import { filterManagedAdminExtensionsByModules } from "./managed-admin-module-gating"
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

// The full source-free admin: CORE (dashboard, account, settings) plus every
// standard domain extension, composed entirely from published packages. The
// route tree + destinations below are built from this FULL set so it stays
// hydration-stable across the shared image; the NAV is gated per deployment at
// render time (see `WorkspaceContent`) by the active module set (voyant#3063).
const extensions = createManagedAdminExtensions()

// The active module ids this deployment mounts, reported by
// `/auth/bootstrap-status` (voyant#3063). Fetched once and memoized: the set is
// static per deployment, so every workspace navigation reuses the first probe.
// A failed/legacy probe yields `undefined`, which fails OPEN (nav shows every
// module) rather than hiding pages.
let activeModuleIdsPromise: Promise<readonly string[] | undefined> | undefined

function loadActiveModuleIds(): Promise<readonly string[] | undefined> {
  activeModuleIdsPromise ??= managedAuthRuntime
    .getBootstrapStatus()
    .then((status) => status.modules)
    .catch(() => undefined)
  return activeModuleIdsPromise
}

// Semantic-destination resolvers derived at runtime from the registry's route
// bindings, so packaged pages' `useAdminHref`/`useAdminNavigate` (cross-page
// links, post-action redirects) resolve instead of falling back to `#`.
const destinations = buildAdminExtensionDestinations(extensions)

const workspaceGuard = createAdminWorkspaceBeforeLoad({ auth: managedAuthRuntime })

// The `_workspace` auth-guarded layout — built in CODE (no route file). Mirrors
// what `src/routes/_workspace/route.tsx` would declare in a file-routed host.
const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_workspace",
  ssr: "data-only",
  beforeLoad: ({ location }) => workspaceGuard({ location }),
  loader: async ({ context }) => ({
    user: (context as { user: ManagedUser }).user,
    activeModuleIds: await loadActiveModuleIds(),
  }),
  pendingComponent: AdminWorkspacePendingFallback,
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { user, activeModuleIds } = workspaceRoute.useLoaderData()

  return (
    <UserProvider getCurrentUser={managedAuthRuntime.getCurrentUser} initialUser={user}>
      <WorkspaceContent activeModuleIds={activeModuleIds} />
    </UserProvider>
  )
}

function WorkspaceContent({ activeModuleIds }: { activeModuleIds: readonly string[] | undefined }) {
  const { user, isLoading } = useUser<ManagedUser>()

  // Gate the NAV/widgets by the deployment's active module set. The route tree
  // stays full (built once at import, hydration-stable), so this only removes
  // sidebar entries + dashboard widgets for modules this operator does not run —
  // no more dead links to pages whose API isn't mounted (voyant#3063).
  const activeExtensions = useMemo(
    () => filterManagedAdminExtensionsByModules(extensions, activeModuleIds),
    [activeModuleIds],
  )

  return (
    <AdminWorkspaceShell
      user={user}
      isUserLoading={isLoading}
      extensions={activeExtensions}
      destinations={destinations}
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
