import { requestBodyLimit } from "@voyant-travel/hono/middleware/body-size"
import { cors } from "@voyant-travel/hono/middleware/cors"
import { rateLimit } from "@voyant-travel/hono/middleware/rate-limit"
import { securityHeaders } from "@voyant-travel/hono/middleware/security-headers"
import { createApiDispatch, lazyApp } from "@voyant-travel/runtime-core"
import type { ApiDispatch } from "@voyant-travel/runtime-core/api-dispatch"
import type { AppLoader, FetchApp, WaitUntilContext } from "@voyant-travel/runtime-core/types"
import { Hono } from "hono"

export interface CreateVoyantNodeApiDispatchOptions<
  TEnvironment extends object,
  TContext extends WaitUntilContext = WaitUntilContext,
> {
  loadApiApp: AppLoader<TEnvironment, TContext>
  loadAuthHandler: AppLoader<TEnvironment, TContext>
  rewriteAppPath?: (pathname: string) => string
  authRateLimit?: { max: number; windowSeconds: number }
}

/** Build the standard lazy Node API dispatch while keeping app imports host-owned. */
export function createVoyantNodeApiDispatch<
  TEnvironment extends object,
  TContext extends WaitUntilContext = WaitUntilContext,
>(
  options: CreateVoyantNodeApiDispatchOptions<TEnvironment, TContext>,
): ApiDispatch<TEnvironment, TContext> {
  const loadAuthApp = lazyApp<TEnvironment, TContext>(async () => {
    const authApp = new Hono<{ Bindings: TEnvironment }>()
    authApp.use("*", cors())
    authApp.use("*", securityHeaders())
    authApp.use("*", requestBodyLimit({ maxBytes: 1024 * 1024 }))
    authApp.use(
      "*",
      rateLimit({ bucket: "auth", max: 10, windowSeconds: 60, ...options.authRateLimit }),
    )
    authApp.all("*", async (context) => {
      const authHandler = await options.loadAuthHandler()
      return authHandler.fetch(
        context.req.raw,
        context.env,
        asRequestContext<TContext>(context.executionCtx),
      )
    })
    return authApp as FetchApp<TEnvironment, TContext>
  })

  return createApiDispatch({
    loadApiApp: options.loadApiApp,
    loadAuthApp,
    warmApiOnAuth: false,
    ...(options.rewriteAppPath ? { rewriteAppPath: options.rewriteAppPath } : {}),
  })
}

function asRequestContext<TContext extends WaitUntilContext>(context: WaitUntilContext): TContext {
  return context as TContext
}
