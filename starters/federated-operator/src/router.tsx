import {
  attachAdminExtensionRoutes,
  buildAdminExtensionRoutes,
  createAdminRouter,
} from "@voyant-travel/admin/app"
import { createFederatedAdminExtensions } from "./lib/admin-extensions"
import { getApiUrl } from "./lib/env"
import { federatedOperatorFetcher } from "./lib/voyant-fetcher"
import { Route as workspaceRoute } from "./routes/_workspace/route"
import { routeTree } from "./routeTree.gen"

const federatedAdminExtensions = createFederatedAdminExtensions()

const federatedAdminRoutes = buildAdminExtensionRoutes(
  federatedAdminExtensions,
  () => workspaceRoute,
  () => ({ baseUrl: getApiUrl(), fetcher: federatedOperatorFetcher }),
)

const federatedRouteTree = attachAdminExtensionRoutes(
  routeTree,
  workspaceRoute,
  federatedAdminRoutes,
)

export function getRouter() {
  return createAdminRouter({ routeTree: federatedRouteTree })
}
