import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { withActiveRouteSsrManifest } from "@voyant-travel/runtime"
import type { ExecutionContext } from "hono"

/** The SSR request handler produced by {@link createAdminSsrHandler}. */
export type AdminSsrHandler<Env = Record<string, unknown>> = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Response | Promise<Response>

/**
 * Build the TanStack Start SSR handler for an admin application. The
 * `createStartHandler` wrap (with the active-route SSR-manifest restriction) is
 * packaged here so hosts do not reimplement it; the handler still relies on the
 * consuming app's TanStack Start build to provide the router.
 *
 * Hosts isolate this in its own module and dynamic-`import()` it behind the
 * non-API branch so `@tanstack/react-start/server` — which statically pulls
 * React and `react-dom/server` (~2.2 MB) — stays OUT of the API startup graph.
 *
 * See docs/architecture/deployment-targets.md.
 */
export function createAdminSsrHandler<Env = Record<string, unknown>>(): AdminSsrHandler<Env> {
  const startHandler = createStartHandler(withActiveRouteSsrManifest(defaultStreamHandler))

  return (request, env, _ctx) => startHandler(request, { context: { env } } as never)
}
