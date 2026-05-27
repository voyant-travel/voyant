import type { Hono } from "hono"

const API_PREFIX = "/api"

type HonoFetchApp = Pick<Hono, "fetch">
type HonoAppLoader = () => Promise<HonoFetchApp>

let apiAppPromise: Promise<HonoFetchApp> | undefined

export function loadOperatorApiApp(): Promise<HonoFetchApp> {
  if (!apiAppPromise) {
    apiAppPromise = import("./api/app").then((mod) => ({
      fetch: (request, env, ctx) => mod.app.fetch(request, env as CloudflareBindings, ctx),
    }))
  }
  return apiAppPromise
}

export function isHonoApiRequest(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`)
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
): Promise<Response> {
  const apiApp = await loadHonoApp()
  return apiApp.fetch(createHonoApiRequest(request), env, ctx)
}
