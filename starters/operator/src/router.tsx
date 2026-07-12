import {
  type AdminRouterContext,
  attachAdminExtensionRoutes,
  buildAdminExtensionRoutes,
  createAdminRouter,
} from "@voyant-travel/admin/app"

import { adminExtensions } from "./lib/admin-extensions"
import { getApiUrl } from "./lib/env"
import { projectFetcher } from "./lib/voyant-fetcher"
import { Route as workspaceRoute } from "./routes/_workspace/route"
import { routeTree } from "./routeTree.gen"

export type RouterContext = AdminRouterContext

// The graph-generated extension bundle and project-local `src/admin/*`
// conventions share one runtime route path. No committed route registry is
// required in the deployment source tree.
const adminRoutes = buildAdminExtensionRoutes(
  adminExtensions,
  () => workspaceRoute,
  () => ({ baseUrl: getApiUrl(), fetcher: projectFetcher }),
)

const operatorRouteTree = attachAdminExtensionRoutes(routeTree, workspaceRoute, adminRoutes)

export function getRouter() {
  return createAdminRouter({ routeTree: operatorRouteTree })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
