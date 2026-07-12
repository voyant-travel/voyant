import { serveStatic } from "@hono/node-server/serve-static"
import type { ExecutionContext } from "hono"
import { Hono } from "hono"

/** Options for {@link serveAdminHost}. */
export interface ServeAdminHostOptions<Env extends object> {
  /**
   * Directory of built client assets (e.g. `dist/client`), served for
   * `/assets/*` and other public files before falling through to the app.
   */
  clientAssetsDir: string
  /**
   * The combined API + SSR app to fall through to for any request that is not a
   * built client asset. Receives the raw request, the request-scoped env
   * bindings, and the execution context.
   */
  app: (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>
}

/**
 * Build the Node serving seam for an admin application: a Hono app that
 * serves built client assets from `clientAssetsDir`, then falls through to the
 * combined API + SSR app for every non-asset route.
 *
 * The SSR handler renders the document shell for any non-asset route, so no
 * explicit SPA index fallback is needed. In dev the assets 404 here and are
 * served by Vite's own middleware instead.
 *
 * This packages the static-host + fall-through that admin hosts (the operator
 * starter and the future managed admin host, voyant#3044) previously held
 * inline as a `web` Hono app.
 */
export function serveAdminHost<Env extends object = Record<string, unknown>>(
  options: ServeAdminHostOptions<Env>,
): Hono<{ Bindings: Env }> {
  const web = new Hono<{ Bindings: Env }>()
  web.use("*", serveStatic({ root: options.clientAssetsDir }))
  web.all("*", (c) => options.app(c.req.raw, c.env, c.executionCtx))
  return web
}
