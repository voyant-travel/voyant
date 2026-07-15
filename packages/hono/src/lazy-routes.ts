/**
 * First-class lazy route mounting for `@voyant-travel/hono`.
 *
 * A module or extension can declare `lazyAdminRoutes` / `lazyPublicRoutes` as a
 * loader (`() => import("./routes").then((m) => m.createRoutes(opts))`) instead
 * of eager `adminRoutes` / `publicRoutes`. The route bundle is dynamically
 * imported on first matching request and cached per isolate/process, so heavy
 * route families don't inflate the main bundle or the Worker cold start.
 *
 * For deployment-local families that span MULTIPLE absolute path prefixes (e.g.
 * an operator bundle exposing `/v1/admin/uploads` and `/v1/admin/media/*`),
 * the single-surface loaders don't fit. Such families declare `lazyRoutes`:
 * `{ paths, load }` where `load` returns a sub-app whose routes are ABSOLUTE and
 * `paths` are the explicit matchers the framework installs up front. This is the
 * context-preserving replacement for the starter's `mountLazyRouteApp(...)`.
 *
 * The hard requirement (and the reason the starter's old `mountLazyRouteApp`
 * was insufficient): the lazy routes must behave **exactly** like eager routes.
 * Eager routes mounted via `app.route(...)` share the request context, so they
 * see `c.var.db`, `c.var.container`, the resolved actor, etc. set by the
 * `createApp` middleware pipeline. A naive `subApp.fetch(c.req.raw, c.env)`
 * forward builds a fresh context and drops every `c.var`.
 *
 * So this dispatcher bridges the request-scoped context across the forward: it
 * snapshots `c.var`, carries it on the forwarded `env` under a private symbol,
 * and a wrapper middleware re-hydrates it onto the loaded sub-app's context
 * before the real routes run. The db lease is *carried*, not re-acquired — the
 * outer `db` middleware still owns its lifecycle (dispose), so there is no
 * double-release.
 */
import type { Context, Hono as HonoType } from "hono"
import { Hono } from "hono"

import { tryGetExecutionCtx } from "./lib/execution-ctx.js"

// biome-ignore lint/suspicious/noExplicitAny: lazy sub-apps keep route-specific Hono env generics -- owner: hono; matches existing module route typing.
type AnyHono = HonoType<any>

/** Loads (and builds) the Hono sub-app for a lazy route surface. */
export type LazyRoutesLoader = () => Promise<AnyHono>

/**
 * A deployment-local lazy route family spanning explicit absolute path
 * matchers. `load` returns a sub-app whose routes are ABSOLUTE; `paths` are the
 * matchers the framework installs up front (no bundle import until a request
 * matches).
 */
export interface LazyApiRoutes {
  paths: readonly string[]
  load: LazyRoutesLoader
}

/** Private carrier key for snapshotting `c.var` across the forward. */
const LAZY_CONTEXT_CARRIER = Symbol.for("voyant.hono.lazyContextCarrier")
const LAZY_ROUTE_MISS_HEADER = "x-voyant-lazy-route-miss"

function withoutLazyRouteMissHeader(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.delete(LAZY_ROUTE_MISS_HEADER)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Build a cached, context-preserving request handler. `mountPrefix` is where the
 * loaded routes are re-mounted in the wrapper sub-app so the forwarded absolute
 * request URL matches: the surface prefix (e.g. `/v1/admin/flights`) for
 * relative-route loaders, or `"/"` for loaders that already return absolute
 * routes.
 */
export function createLazyRouteHandler(mountPrefix: string, load: LazyRoutesLoader) {
  let cached: Promise<AnyHono> | undefined

  function getApp(): Promise<AnyHono> {
    // Cache the BUILT, wrapped sub-app; reset on failure so a transient
    // import/config error can recover on the next request.
    if (!cached) {
      cached = load()
        .then((routes) => {
          const wrapped = new Hono()
          // Re-throw handler errors instead of letting the wrapper sub-app's
          // default Hono error handler swallow them into a plain 500. This
          // propagates the throw back through `app.fetch` to the outer
          // `createApp` pipeline, so lazy routes hit the same `errorBoundary` /
          // `handleApiError` normalization (JSON error shape + structured
          // logging) as eager `app.route(...)` mounts.
          wrapped.onError((err) => {
            throw err
          })
          wrapped.notFound(
            () => new Response(null, { status: 404, headers: { [LAZY_ROUTE_MISS_HEADER]: "1" } }),
          )
          wrapped.use("*", async (cc, next) => {
            const carried = (cc.env as Record<symbol, unknown> | undefined)?.[
              LAZY_CONTEXT_CARRIER
            ] as Record<string, unknown> | undefined
            if (carried) {
              for (const [key, value] of Object.entries(carried)) {
                // biome-ignore lint/suspicious/noExplicitAny: re-hydrating arbitrary context vars -- owner: hono.
                cc.set(key as never, value as any)
              }
            }
            await next()
          })
          wrapped.route(mountPrefix, routes)
          return wrapped
        })
        .catch((err) => {
          cached = undefined
          throw err
        })
    }
    return cached
  }

  return async (c: Context, next?: () => Promise<void>): Promise<Response> => {
    const app = await getApp()
    const snapshot = { ...c.var }
    const env = { ...(c.env as Record<string, unknown>), [LAZY_CONTEXT_CARRIER]: snapshot }
    // biome-ignore lint/suspicious/noExplicitAny: forward the host execution context when present -- owner: hono.
    const response = await app.fetch(c.req.raw, env, tryGetExecutionCtx(c) as any)
    const routeMiss = response.headers.get(LAZY_ROUTE_MISS_HEADER) === "1"
    if (routeMiss && next) {
      // Match eager `app.route(...)` composition: overlapping lazy mounts under
      // the same prefix must let later modules/extensions try the request.
      await next()
      return c.res
    }
    return routeMiss ? withoutLazyRouteMissHeader(response) : response
  }
}

/**
 * Register a single lazy surface on `app` at `prefix` (loader returns RELATIVE
 * routes). Matches both the prefix root (`POST /v1/admin/foo`) and any sub-path
 * (`/v1/admin/foo/bar`).
 */
export function mountLazyRoutesAt(app: AnyHono, prefix: string, load: LazyRoutesLoader): void {
  const handler = createLazyRouteHandler(prefix, load)
  app.all(prefix, handler)
  app.all(`${prefix}/*`, handler)
}

/**
 * Register a multi-prefix lazy family on `app` at explicit `paths` (loader
 * returns ABSOLUTE routes). One shared cached/context-bridging handler backs
 * every path. Context-preserving replacement for the starter's
 * `mountLazyRouteApp(...)`.
 */
export function mountLazyRoutePaths(
  app: AnyHono,
  paths: readonly string[],
  load: LazyRoutesLoader,
): void {
  const handler = createLazyRouteHandler("/", load)
  for (const path of paths) {
    app.all(path, handler)
  }
}
