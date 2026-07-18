import type { ApiModule, ClientAuthenticatedRoute } from "./module.js"

export interface AbsoluteClientAuthenticatedRoute {
  method: ClientAuthenticatedRoute["method"]
  path: string
}

/** Resolve trusted module declarations to exact, app-local admin routes. */
export function assembleClientAuthenticatedRoutes(
  modules: readonly ApiModule[],
): AbsoluteClientAuthenticatedRoute[] {
  const routes = new Map<string, AbsoluteClientAuthenticatedRoute>()

  for (const module of modules) {
    const prefix = `/v1/admin/${module.module.name}`
    for (const route of module.clientAuthenticated ?? []) {
      const trimmed = route.path.trim()
      if (!trimmed.startsWith("/") || trimmed.includes(":") || trimmed.includes("*")) {
        throw new Error(
          `clientAuthenticated route for module "${module.module.name}" must be a concrete relative path beginning with "/"`,
        )
      }
      const path = `${prefix}${trimmed === "/" ? "" : trimmed.replace(/\/+$/g, "")}`
      const resolved = { method: route.method, path }
      routes.set(`${resolved.method} ${resolved.path}`, resolved)
    }
  }

  return [...routes.values()].sort((left, right) =>
    `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`),
  )
}

export function matchesClientAuthenticatedRoute(
  method: string,
  pathname: string,
  routes: readonly AbsoluteClientAuthenticatedRoute[],
): boolean {
  return routes.some((route) => route.method === method.toUpperCase() && route.path === pathname)
}
