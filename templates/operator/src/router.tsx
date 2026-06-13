import {
  type AdminRouterContext,
  attachAdminExtensionRoutes,
  createAdminRouter,
} from "@voyantjs/admin/app"

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
 *
 * Extension routes REPLACE file routes on key conflicts (Omit before the
 * intersection), mirroring `attachAdminExtensionRoutes`' replace-by-path
 * graft semantics — e.g. the pathless workspace layout claims `/` in the
 * generated file types, but at runtime `/` is the core extension's
 * dashboard route.
 */
type MergeRouteTypeMaps<TFileMap, TExtensionMap> = Omit<TFileMap, keyof TExtensionMap> &
  TExtensionMap

export interface OperatorFileRouteTypes {
  fileRoutesByFullPath: MergeRouteTypeMaps<
    FileRouteTypes["fileRoutesByFullPath"],
    AdminExtensionRoutesByFullPath
  >
  fullPaths: FileRouteTypes["fullPaths"] | keyof AdminExtensionRoutesByFullPath
  fileRoutesByTo: MergeRouteTypeMaps<FileRouteTypes["fileRoutesByTo"], AdminExtensionRoutesByTo>
  to: FileRouteTypes["to"] | keyof AdminExtensionRoutesByTo
  fileRoutesById: MergeRouteTypeMaps<FileRouteTypes["fileRoutesById"], AdminExtensionRoutesById>
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
