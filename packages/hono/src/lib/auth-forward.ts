import type { Hono } from "hono"

import { reportException } from "../middleware/error-boundary.js"
import type { Reporter } from "../observability/reporter.js"
import type { VoyantBindings, VoyantExecutionContext, VoyantVariables } from "../types.js"
import { tryGetExecutionCtx } from "./execution-ctx.js"

/** Shape of the deployment-supplied auth sub-app (see `VoyantAuthIntegration.handler`). */
type AuthAppFactory<TBindings> = (env: TBindings) => {
  fetch: (
    req: Request,
    env: TBindings,
    ctx?: VoyantExecutionContext,
  ) => Response | Promise<Response>
}

/**
 * Mount the app-owned auth handler at `/auth/*`, forwarding requests into the
 * deployment's auth sub-app. Two observability concerns are handled here so the
 * sub-app — which renders its own error responses and never reaches the outer
 * `onError` — stays consistent with the rest of the app (RFC voyant#1553):
 *
 * 1. The outer correlation id is injected into the forwarded request, so the
 *    sub-app reuses it instead of minting a second, uncorrelated id.
 * 2. A 5xx response from the sub-app is bridged into the reporter with that same
 *    id, so auth faults aren't an observability blind spot.
 */
export function mountAuthForwarding<TBindings extends VoyantBindings>(
  app: Hono<{ Bindings: TBindings; Variables: VoyantVariables }>,
  authHandler: AuthAppFactory<TBindings>,
  options: { reporter: Reporter; appName: string },
): void {
  app.all("/auth/*", async (c) => {
    const authApp = authHandler(c.env)
    const id = c.get("requestId")
    const forwardedHeaders = new Headers(c.req.raw.headers)
    if (id) forwardedHeaders.set("x-request-id", id)
    const forwarded = new Request(c.req.raw, { headers: forwardedHeaders })
    const res = await authApp.fetch(forwarded, c.env, tryGetExecutionCtx(c))
    if (res.status >= 500) {
      reportException(options.reporter, c, {
        requestId: id ?? "",
        app: options.appName,
        error: new Error(`auth handler returned HTTP ${res.status}`),
        context: { path: c.req.path, method: c.req.method, status: res.status, surface: "auth" },
      })
    }
    return res
  })
}
