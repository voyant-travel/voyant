import { requestBodyLimit } from "@voyant-travel/hono/middleware/body-size"
import { cors } from "@voyant-travel/hono/middleware/cors"
import { rateLimit } from "@voyant-travel/hono/middleware/rate-limit"
import { securityHeaders } from "@voyant-travel/hono/middleware/security-headers"
import { createApiDispatch, lazyApp } from "@voyant-travel/runtime"
import type { FetchApp } from "@voyant-travel/runtime/types"
import { Hono } from "hono"

/**
 * App-owned loaders for the framework-owned dispatch in
 * `@voyant-travel/runtime`: this file only knows WHICH modules to load;
 * prefix matching, URL rewriting, lean-auth dispatch, and background API
 * warm-up live in the package and arrive via version bumps.
 */

const loadOperatorApiApp = lazyApp<CloudflareBindings, ExecutionContext>(() =>
  import("./api/app").then((mod) => ({
    fetch: (request, env, ctx) => mod.app.fetch(request, env as CloudflareBindings, ctx),
  })),
)

const loadOperatorAuthHandler = lazyApp<CloudflareBindings, ExecutionContext>(() =>
  import("./api/auth/handler").then((mod) => ({
    fetch: (request, env, ctx) => mod.default.fetch(request, env as CloudflareBindings, ctx),
  })),
)

/**
 * Lean auth app: CORS + the Better Auth handler, nothing else. Keeps
 * `/api/auth/*` (including preflight) off the full API module graph.
 */
const loadOperatorAuthApp = lazyApp<CloudflareBindings, ExecutionContext>(async () => {
  const authApp = new Hono<{ Bindings: CloudflareBindings }>()
  authApp.use("*", cors())
  authApp.use("*", securityHeaders())
  authApp.use("*", requestBodyLimit({ maxBytes: 1024 * 1024 }))
  authApp.use(
    "*",
    rateLimit({
      bucket: "auth",
      max: 10,
      windowSeconds: 60,
    }),
  )
  authApp.all("*", async (c) => {
    const authHandler = await loadOperatorAuthHandler()
    return authHandler.fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext)
  })
  return authApp as FetchApp<CloudflareBindings, ExecutionContext>
})

export const operatorApiDispatch = createApiDispatch<CloudflareBindings, ExecutionContext>({
  loadApiApp: loadOperatorApiApp,
  loadAuthApp: loadOperatorAuthApp,
  // Cloud isolates are frequently evicted; auth/JWKS traffic must not kick off
  // the full framework module graph while answering the lean auth response.
  warmApiOnAuth: false,
  rewriteAppPath: (pathname) =>
    pathname.startsWith("/v1/media/")
      ? pathname.replace("/v1/media/", "/v1/admin/media/")
      : pathname,
})
