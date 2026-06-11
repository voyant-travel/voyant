import {
  type AnyRoute,
  lazyRouteComponent,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router"
import {
  type AdminExtension,
  type AdminRoutePageProps,
  type AdminRouteRuntime,
  type ImplementedAdminRoute,
  requireImplementedAdminRoute,
} from "@voyantjs/admin"
import * as React from "react"

import type { AdminRouterContext } from "./router.js"

/**
 * Code-assembled extension routes (packaged-admin RFC §4.8 endgame).
 *
 * Package-delivered admin pages exist as NO per-route files in the host:
 * the host's generated admin route module turns each extension route
 * contribution into a code-based `createRoute(...)` grafted under the
 * workspace layout via {@link attachAdminExtensionRoutes}. This module is
 * the binding layer between the transport-agnostic contribution contract
 * (`@voyantjs/admin`) and TanStack Router:
 *
 * - {@link adminExtensionRouteOptions} resolves a contribution by id and
 *   returns the router-facing route options — component (lazy, with intent
 *   preload), loader (QueryClient + app runtime + params), per-route `ssr`
 *   mode, and boundaries — ready to spread into `createRoute({...})`.
 * - {@link attachAdminExtensionRoutes} grafts the built routes under the
 *   host's file-based workspace layout, idempotently (replace-by-path), so
 *   dev-server module re-evaluation never duplicates routes.
 */

/** App runtime for extension route loaders — a value or a per-call thunk. */
export type AdminExtensionRouteRuntime = AdminRouteRuntime | (() => AdminRouteRuntime)

function resolveRuntime(runtime: AdminExtensionRouteRuntime): AdminRouteRuntime {
  return typeof runtime === "function" ? runtime() : runtime
}

/**
 * Loader args the bound extension loader reads. Deliberately a subset of
 * TanStack's loader context — the binder only forwards what the
 * contribution contract knows about (QueryClient via router context, path
 * params), which keeps contributions router-agnostic.
 */
export interface AdminExtensionRouteLoaderArgs {
  context: AdminRouterContext
  params: Record<string, string>
}

type PreloadableComponent = React.FunctionComponent & {
  preload?: () => Promise<void>
}

export interface AdminExtensionRouteOptions {
  component: PreloadableComponent
  loader: (args: AdminExtensionRouteLoaderArgs) => unknown
  ssr?: boolean | "data-only"
  /**
   * Set for lazy `page` contributions: the binder component suspends while
   * the page chunk loads, and the route's pending boundary is what should
   * catch that — not an ancestor boundary.
   */
  wrapInSuspense?: boolean
  pendingComponent?: React.FunctionComponent
  errorComponent?: React.FunctionComponent<{ error: Error; reset: () => void }>
}

interface LazyPageModule {
  default: React.ComponentType<AdminRoutePageProps>
}

/**
 * Wrap a lazy `page` contribution into a route component that injects route
 * state ({@link AdminRoutePageProps}) read from the matched route. The page
 * chunk stays code-split (the router's lazy-component machinery), and the
 * wrapper forwards `preload` so hover/intent preloading fetches the chunk
 * ahead of navigation.
 */
function createAdminRoutePageComponent(route: ImplementedAdminRoute): PreloadableComponent {
  const page = route.page
  if (!page) {
    throw new Error(
      `[voyant-admin-app] Route contribution "${route.id}" has no \`page\` loader to bind.`,
    )
  }
  const LazyPage = lazyRouteComponent(
    page as () => Promise<LazyPageModule>,
  ) as unknown as React.FunctionComponent<AdminRoutePageProps> & { preload?: () => Promise<void> }

  function AdminExtensionRoutePage() {
    const params = useParams({ strict: false }) as Record<string, string>
    const search = useSearch({ strict: false }) as Record<string, unknown>
    const navigate = useNavigate()
    const updateSearch = React.useCallback<AdminRoutePageProps["updateSearch"]>(
      (updater, options) => {
        void navigate({
          // Same-route navigation: patch search state in place.
          to: ".",
          search: (prev: Record<string, unknown>) => updater(prev),
          replace: options?.replace ?? true,
        })
      },
      [navigate],
    )

    return (
      <LazyPage params={params} search={search} updateSearch={updateSearch} title={route.title} />
    )
  }
  AdminExtensionRoutePage.displayName = `AdminExtensionRoutePage(${route.id})`
  AdminExtensionRoutePage.preload = (LazyPage as PreloadableComponent).preload
  return AdminExtensionRoutePage
}

/**
 * Resolve an extension route contribution by id and return the route
 * options the host's generated admin route module spreads into a
 * code-based `createRoute({...})`.
 *
 * Path and typed search contract stay literal in the generated module (they
 * are what gives the host typed links); everything else — page, loader,
 * SSR mode, boundaries — comes from the contribution.
 */
export function adminExtensionRouteOptions(
  extension: AdminExtension,
  routeId: string,
  runtime: AdminExtensionRouteRuntime,
): AdminExtensionRouteOptions {
  const route = requireImplementedAdminRoute(extension, routeId)
  const component = route.page
    ? createAdminRoutePageComponent(route)
    : (route.component as PreloadableComponent)

  return {
    component,
    loader: ({ context, params }: AdminExtensionRouteLoaderArgs) =>
      route.loader?.({
        queryClient: context.queryClient,
        runtime: resolveRuntime(runtime),
        params,
      }),
    ssr: route.ssr,
    wrapInSuspense: route.page ? true : undefined,
    pendingComponent: route.pendingComponent as React.FunctionComponent | undefined,
    errorComponent: route.errorComponent as
      | React.FunctionComponent<{ error: Error; reset: () => void }>
      | undefined,
  }
}

/**
 * Graft code-built extension routes under a file-based parent route
 * (typically the workspace layout) and return the tree for `_addFileTypes`
 * re-typing. Idempotent: an extension route replaces any previously grafted
 * route with the same path, so dev-server re-evaluation of the generated
 * module never duplicates children.
 */
export function attachAdminExtensionRoutes<TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  parentRoute: AnyRoute,
  extensionRoutes: ReadonlyArray<AnyRoute>,
): TRouteTree {
  const existing: Array<AnyRoute> = Array.isArray(parentRoute.children)
    ? (parentRoute.children as Array<AnyRoute>)
    : []
  const extensionPaths = new Set(
    extensionRoutes.map((route) => (route.options as { path?: string }).path),
  )
  const children = [
    ...existing.filter((route) => !extensionPaths.has((route.options as { path?: string }).path)),
    ...extensionRoutes,
  ]
  parentRoute.addChildren(children)
  return routeTree
}
