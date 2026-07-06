import { requestBodyLimit } from "@voyant-travel/hono/middleware/body-size"
import { cors } from "@voyant-travel/hono/middleware/cors"
import { rateLimit } from "@voyant-travel/hono/middleware/rate-limit"
import { securityHeaders } from "@voyant-travel/hono/middleware/security-headers"
import { createApiDispatch, lazyApp } from "@voyant-travel/runtime"
import type { FetchApp } from "@voyant-travel/runtime/types"
import { Hono } from "hono"

const loadFederatedOperatorApiApp = lazyApp<CloudflareBindings, ExecutionContext>(() =>
  import("./api/app").then((mod) => ({
    fetch: (request, env, ctx) => mod.app.fetch(request, env as CloudflareBindings, ctx),
  })),
)

const loadFederatedOperatorAuthHandler = lazyApp<CloudflareBindings, ExecutionContext>(() =>
  import("./api/auth/handler").then((mod) => ({
    fetch: (request, env, ctx) => mod.default.fetch(request, env as CloudflareBindings, ctx),
  })),
)

const loadFederatedOperatorAuthApp = lazyApp<CloudflareBindings, ExecutionContext>(async () => {
  const authApp = new Hono<{ Bindings: CloudflareBindings }>()
  authApp.use("*", cors())
  authApp.use("*", securityHeaders())
  authApp.use("*", requestBodyLimit({ maxBytes: 1024 * 1024 }))
  authApp.use("*", rateLimit({ bucket: "auth", max: 10, windowSeconds: 60 }))
  authApp.all("*", async (c) => {
    const authHandler = await loadFederatedOperatorAuthHandler()
    return authHandler.fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext)
  })
  return authApp as FetchApp<CloudflareBindings, ExecutionContext>
})

export const federatedOperatorApiDispatch = createApiDispatch<CloudflareBindings, ExecutionContext>(
  {
    loadApiApp: loadFederatedOperatorApiApp,
    loadAuthApp: loadFederatedOperatorAuthApp,
    rewriteAppPath: (pathname) =>
      pathname.startsWith("/v1/media/")
        ? pathname.replace("/v1/media/", "/v1/admin/media/")
        : pathname,
  },
)
