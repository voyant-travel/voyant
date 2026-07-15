import type { Hono } from "hono"

import type { ApiExtension, ApiModule } from "./module.js"
import { resolveSurfaceMountPath } from "./mount-paths.js"

/**
 * Assemble the anonymous-access allow-list (ADR-0008) from module/extension
 * `anonymous` declarations, unioned with any explicit `publicPaths` the
 * deployment still passes (the escape hatch — e.g. plugin/webhook routes that
 * aren't owned by a module, like a payment-processor callback).
 *
 * For each declaring unit the public mount is `resolveSurfaceMountPath` of its
 * `publicPath`/name under `/v1/public`. `anonymous: true` opens the whole mount;
 * a string array opens specific sub-paths relative to it. Pure and sorted for a
 * deterministic, snapshot-auditable result; the global list is what `requireAuth`
 * matches to skip auth (and stamp `actor: "customer"`).
 */
export function assembleAnonymousPaths(
  modules: readonly ApiModule[],
  extensions: readonly ApiExtension[],
  explicit: readonly string[] = [],
): string[] {
  const paths = new Set<string>(explicit)

  const add = (mount: string, anonymous: boolean | readonly string[] | undefined): void => {
    if (!anonymous) return
    if (anonymous === true) {
      paths.add(mount)
      return
    }
    for (const sub of anonymous) {
      const trimmed = sub.trim().replace(/^\/+|\/+$/g, "")
      paths.add(trimmed ? `${mount}/${trimmed}` : mount)
    }
  }

  // Inbound webhook routes are unauthenticated by construction (the handler
  // verifies the provider signature), so their concrete absolute paths are
  // auto-added to the allow-list — no per-deployment `publicPaths` entry. Mounted
  // at `/v1/{name}`, matching the mount in `app.ts`. Parameterized/wildcard paths
  // are skipped (the literal `matchesPublicPath` matcher can't match them) and
  // must be declared via `anonymous` if ever needed.
  // biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics -- owner: hono; mirrors the ApiModule.webhookRoutes suppression.
  const addWebhooks = (name: string, routes: Hono<any> | undefined): void => {
    if (!routes) return
    for (const route of routes.routes) {
      const path = route.path
      if (path.includes(":") || path.includes("*")) continue
      const trimmed = path.replace(/\/+$/g, "")
      paths.add(`/v1/${name}${trimmed === "/" ? "" : trimmed}`)
    }
  }

  for (const m of modules) {
    add(resolveSurfaceMountPath("/v1/public", m.publicPath, m.module.name), m.anonymous)
    addWebhooks(m.module.name, m.webhookRoutes)
  }
  for (const e of extensions) {
    add(resolveSurfaceMountPath("/v1/public", e.publicPath, e.extension.module), e.anonymous)
    addWebhooks(e.extension.module, e.webhookRoutes)
  }

  return [...paths].sort()
}
