/**
 * SSR-manifest restriction for TanStack Start workers.
 *
 * By default the SSR stream emits preload/asset hints for every route in the
 * manifest; on large admins that floods the first paint with hundreds of
 * speculative preloads. Restricting the manifest to the matched routes keeps
 * the initial response lean. Typed structurally so this package needs no
 * dependency on the router — any router exposing `stores.matches` and an
 * `ssr.manifest` fits.
 */

type ManifestRoute = {
  assets?: Array<unknown>
  preloads?: Array<unknown>
}

export type SsrManifest = {
  inlineCss?: unknown
  routes: Record<string, ManifestRoute | undefined>
}

export interface SsrManifestRouter {
  stores: {
    matches: {
      get(): ReadonlyArray<{ routeId: string }>
    }
  }
  ssr?: {
    readonly manifest?: SsrManifest
  }
}

/**
 * Replace `router.ssr.manifest` with a view filtered to the active route
 * matches. The filter runs lazily (getter) because matches settle after the
 * handler installs the restriction.
 */
export function restrictSsrManifestToActiveRoutes(router: SsrManifestRouter): void {
  const ssr = router.ssr
  if (!ssr?.manifest) return

  router.ssr = {
    get manifest(): SsrManifest | undefined {
      const manifest = ssr.manifest
      if (!manifest) return manifest

      const activeRouteIds = new Set(router.stores.matches.get().map((match) => match.routeId))
      const routes = Object.fromEntries(
        Object.entries(manifest.routes).filter(([routeId]) => activeRouteIds.has(routeId)),
      )

      return {
        ...manifest,
        routes,
      }
    },
  }
}

/**
 * Wrap a TanStack Start stream-handler callback so every SSR render gets the
 * active-route manifest restriction:
 *
 * ```ts
 * const startHandler = createStartHandler(
 *   withActiveRouteSsrManifest(defaultStreamHandler),
 * )
 * ```
 */
export function withActiveRouteSsrManifest<TCtx extends { router: unknown }, TResult>(
  handler: (ctx: TCtx) => TResult,
): (ctx: TCtx) => TResult {
  return (ctx) => {
    restrictSsrManifestToActiveRoutes(ctx.router as SsrManifestRouter)
    return handler(ctx)
  }
}
