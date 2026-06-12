import {
  type AdminRouterContext,
  attachAdminExtensionRoutes,
  createAdminRouter,
} from "@voyantjs/admin-app"

import {
  type AdminExtensionRoutesByFullPath,
  type AdminExtensionRoutesById,
  type AdminExtensionRoutesByTo,
  adminExtensionRoutes,
} from "./admin.routes.generated"
import { Route as workspaceRoute } from "./routes/_workspace/route"
import { type FileRouteTypes, routeTree } from "./routeTree.gen"

export type RouterContext = AdminRouterContext

/**
 * File-route types merged with the code-assembled extension routes
 * (packaged-admin RFC §4.8): package-delivered pages have no route files, so
 * their typed-link entries come from `admin.routes.generated.tsx` and are
 * stamped onto the tree via `_addFileTypes` — `Link`/`navigate` stay fully
 * typed for file routes AND extension routes alike.
 */
export interface OperatorFileRouteTypes {
  fileRoutesByFullPath: FileRouteTypes["fileRoutesByFullPath"] & AdminExtensionRoutesByFullPath
  fullPaths: FileRouteTypes["fullPaths"] | keyof AdminExtensionRoutesByFullPath
  fileRoutesByTo: FileRouteTypes["fileRoutesByTo"] & AdminExtensionRoutesByTo
  to: FileRouteTypes["to"] | keyof AdminExtensionRoutesByTo
  fileRoutesById: FileRouteTypes["fileRoutesById"] & AdminExtensionRoutesById
  id: FileRouteTypes["id"] | keyof AdminExtensionRoutesById
}

const operatorRouteTree = attachAdminExtensionRoutes(
  routeTree,
  workspaceRoute,
  adminExtensionRoutes,
)._addFileTypes<OperatorFileRouteTypes>()

export function getRouter() {
  return createAdminRouter({ routeTree: operatorRouteTree })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
