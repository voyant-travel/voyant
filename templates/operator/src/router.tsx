import { type AdminRouterContext, createAdminRouter } from "@voyantjs/admin-app"

import { routeTree } from "./routeTree.gen"

export type RouterContext = AdminRouterContext

export function getRouter() {
  return createAdminRouter({ routeTree })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
