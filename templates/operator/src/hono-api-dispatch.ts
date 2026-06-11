import { cors } from "@voyantjs/hono/middleware/cors"
import { createApiDispatch, lazyApp } from "@voyantjs/worker-runtime"
import type { FetchApp } from "@voyantjs/worker-runtime/types"
import { Hono } from "hono"

/**
 * App-owned loaders for the framework-owned dispatch in
 * `@voyantjs/worker-runtime`: this file only knows WHICH modules to load;
 * prefix matching, URL rewriting, lean-auth dispatch, and background API
 * warm-up live in the package and arrive via version bumps.
 */

export const loadOperatorApiApp = lazyApp<CloudflareBindings, ExecutionContext>(() =>
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
export const loadOperatorAuthApp = lazyApp<CloudflareBindings, ExecutionContext>(async () => {
  const authApp = new Hono<{ Bindings: CloudflareBindings }>()
  authApp.use("*", cors())
  authApp.all("*", async (c) => {
    const authHandler = await loadOperatorAuthHandler()
    return authHandler.fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext)
  })
  return authApp as FetchApp<CloudflareBindings, ExecutionContext>
})

export const operatorApiDispatch = createApiDispatch<CloudflareBindings, ExecutionContext>({
  loadApiApp: loadOperatorApiApp,
  loadAuthApp: loadOperatorAuthApp,
})
