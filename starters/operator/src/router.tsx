import {
  type AdminRouterContext,
  attachAdminExtensionRoutes,
  buildAdminExtensionRoutes,
  createAdminRouter,
} from "@voyant-travel/admin/app"
import { Route as workspaceRoute } from "../.voyant/routes/_workspace/route"
import { routeTree } from "../.voyant/routeTree.gen"
import { operatorAdminPresentation } from "./lib/admin-presentation"
import { getApiUrl } from "./lib/env"
import { projectFetcher } from "./lib/voyant-fetcher"

export type RouterContext = AdminRouterContext

// The graph-generated extension bundle and project-local `src/admin/*`
// conventions share one runtime route path. No committed route registry is
// required in the deployment source tree.
const adminRoutes = buildAdminExtensionRoutes(
  operatorAdminPresentation.extensions,
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
