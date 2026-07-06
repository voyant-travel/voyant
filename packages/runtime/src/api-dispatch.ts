import type { AppLoader, FetchApp, WaitUntilContext } from "./types.js"

const DEFAULT_API_PREFIX = "/api"

/**
 * Memoize an app loader so the underlying dynamic `import()` runs once per
 * isolate, no matter how many requests race on it.
 */
export function lazyApp<Env, Ctx extends WaitUntilContext = WaitUntilContext>(
  load: () => Promise<FetchApp<Env, Ctx>>,
): AppLoader<Env, Ctx> {
  let promise: Promise<FetchApp<Env, Ctx>> | undefined
  return () => {
    promise ??= load()
    return promise
  }
}

export interface CreateApiDispatchOptions<Env, Ctx extends WaitUntilContext = WaitUntilContext> {
  /** Loads the full API app (the heavy module graph). Wrap with {@link lazyApp}. */
  loadApiApp: AppLoader<Env, Ctx>
  /**
   * Optional lean auth app. When set, requests under `authPrefix` dispatch to
   * it WITHOUT loading the full API graph — the fix for the cold-start outage
   * where the first `/api/auth/*` call instantiated the whole API and hung.
   * Set `warmApiOnAuth` to opt into background API warm-up after auth traffic.
   */
  loadAuthApp?: AppLoader<Env, Ctx>
  /** Hosting prefix stripped before dispatch. Default `/api`. */
  apiPrefix?: string
  /**
   * Optional post-strip app-path rewrite. Runs after `/api` is removed and
   * before the request is forwarded to the app.
   */
  rewriteAppPath?: (pathname: string) => string
  /** Auth sub-prefix served by the lean app. Default `${apiPrefix}/auth`. */
  authPrefix?: string
  /** Background-warm the full app on auth traffic. Default false. */
  warmApiOnAuth?: boolean
  /** Called when the background warm-up fails. Defaults to `console.error`. */
  onWarmError?: (error: unknown) => void
}

export interface ApiDispatch<Env, Ctx extends WaitUntilContext = WaitUntilContext> {
  isApiRequest(pathname: string): boolean
  isAuthRequest(pathname: string): boolean
  /** Strip the hosting prefix (`/api/v1/x` → `/v1/x`), preserving search/body. */
  toAppRequest(request: Request): Request
  dispatch(request: Request, env: Env, ctx: Ctx): Promise<Response>
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * Prefix-routed dispatch from a hosting Worker URL space (`/api/*`) onto a
 * Hono-style app surface (`/v1/*`, `/auth/*`, `/health`). Framework-owned:
 * apps supply only the loaders for their own modules.
 */
export function createApiDispatch<Env, Ctx extends WaitUntilContext = WaitUntilContext>(
  options: CreateApiDispatchOptions<Env, Ctx>,
): ApiDispatch<Env, Ctx> {
  const apiPrefix = options.apiPrefix ?? DEFAULT_API_PREFIX
  const authPrefix = options.authPrefix ?? `${apiPrefix}/auth`
  const warmApiOnAuth = options.warmApiOnAuth ?? false
  const onWarmError =
    options.onWarmError ??
    ((error: unknown) => {
      console.error("[worker-runtime] background API warm failed:", error)
    })

  function toAppRequest(request: Request): Request {
    const url = new URL(request.url)
    const stripped = url.pathname.slice(apiPrefix.length) || "/"
    const appPath = options.rewriteAppPath?.(stripped) ?? stripped
    const appUrl = new URL(appPath, url.origin)
    appUrl.search = url.search

    const bodyless = request.method === "GET" || request.method === "HEAD"
    return new Request(appUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: bodyless ? null : request.body,
      redirect: request.redirect,
      signal: request.signal,
      ...(bodyless ? {} : { duplex: "half" }),
    } as RequestInit)
  }

  async function dispatch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const { loadApiApp, loadAuthApp } = options
    if (loadAuthApp && matchesPrefix(new URL(request.url).pathname, authPrefix)) {
      const authApp = await loadAuthApp()
      const response = await authApp.fetch(toAppRequest(request), env, ctx)
      if (warmApiOnAuth && request.method !== "OPTIONS") {
        ctx.waitUntil(loadApiApp().then(() => undefined, onWarmError))
      }
      return response
    }

    const apiApp = await loadApiApp()
    return apiApp.fetch(toAppRequest(request), env, ctx)
  }

  return {
    isApiRequest: (pathname) => matchesPrefix(pathname, apiPrefix),
    isAuthRequest: (pathname) => matchesPrefix(pathname, authPrefix),
    toAppRequest,
    dispatch,
  }
}
