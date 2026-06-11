import type { Hono } from "hono"

const API_PREFIX = "/api"
const AUTH_API_PREFIX = `${API_PREFIX}/auth`

type HonoFetchApp = Pick<Hono, "fetch">
type HonoAppLoader = () => Promise<HonoFetchApp>

let apiAppPromise: Promise<HonoFetchApp> | undefined
let authAppPromise: Promise<HonoFetchApp> | undefined

export function loadOperatorApiApp(): Promise<HonoFetchApp> {
  if (!apiAppPromise) {
    apiAppPromise = import("./api/app").then((mod) => ({
      fetch: (request, env, ctx) => mod.app.fetch(request, env as CloudflareBindings, ctx),
    }))
  }
  return apiAppPromise
}

export function loadOperatorAuthApp(): Promise<HonoFetchApp> {
  if (!authAppPromise) {
    authAppPromise = import("./api/auth/handler").then((mod) => ({
      fetch: (request, env, ctx) => mod.default.fetch(request, env as CloudflareBindings, ctx),
    }))
  }
  return authAppPromise
}

export function isHonoApiRequest(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`)
}

export function isHonoAuthApiRequest(pathname: string): boolean {
  return pathname === AUTH_API_PREFIX || pathname.startsWith(`${AUTH_API_PREFIX}/`)
}

export function createHonoApiRequest(request: Request): Request {
  const url = new URL(request.url)
  const stripped = url.pathname.slice(API_PREFIX.length) || "/"
  const apiUrl = new URL(stripped, url.origin)
  apiUrl.search = url.search

  return new Request(apiUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? null : request.body,
    redirect: request.redirect,
    signal: request.signal,
    ...(request.method === "GET" || request.method === "HEAD" ? {} : { duplex: "half" }),
  } as RequestInit)
}

/**
 * Shared adapter for the Cloudflare Worker entrypoint and future TanStack Start
 * server route files. Hono remains the API handler model; this only translates
 * the hosting route's `/api/*` URL shape into the app's `/v1/*`, `/auth/*`, and
 * `/health` surface.
 */
export async function dispatchHonoApiRequest(
  request: Request,
  env: CloudflareBindings,
  ctx: ExecutionContext,
  loadHonoApp: HonoAppLoader = loadOperatorApiApp,
  loadAuthApp: HonoAppLoader = loadOperatorAuthApp,
): Promise<Response> {
  if (isHonoAuthApiRequest(new URL(request.url).pathname)) {
    const authApp = await loadAuthApp()
    const response = await authApp.fetch(createHonoApiRequest(request), env, ctx)
    ctx.waitUntil(
      loadHonoApp().catch((error) => {
        console.error("[api] background API warm failed:", error)
      }),
    )
    return response
  }

  const apiApp = await loadHonoApp()
  return apiApp.fetch(createHonoApiRequest(request), env, ctx)
}
