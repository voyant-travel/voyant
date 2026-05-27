const API_PREFIX = "/api"

type HonoFetchApp = {
  fetch(
    request: Request,
    env: CloudflareBindings,
    ctx: ExecutionContext,
  ): Response | Promise<Response>
}

type LoadHonoApp = () => HonoFetchApp | Promise<HonoFetchApp>

let apiAppPromise: Promise<HonoFetchApp> | undefined

function loadOperatorApiApp(): Promise<HonoFetchApp> {
  apiAppPromise ??= import("./api/app").then((mod) => mod.app)
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

  const init: RequestInit & { duplex?: "half" } = {
    headers: request.headers,
    method: request.method,
    redirect: request.redirect,
    signal: request.signal,
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body
    init.duplex = "half"
  }
  return new Request(apiUrl.toString(), init)
}

/**
 * Shared adapter for routing operator API traffic into Hono.
 *
 * Cloudflare's Worker entrypoint calls this for `/api/*` today. A future
 * TanStack Start server route can call the same function and remain a thin
 * file-routing adapter while Hono stays the handler model.
 */
export async function dispatchHonoApiRequest(
  request: Request,
  env: CloudflareBindings,
  ctx: ExecutionContext,
  loadHonoApp: LoadHonoApp = loadOperatorApiApp,
): Promise<Response> {
  const app = await loadHonoApp()
  return app.fetch(createHonoApiRequest(request), env, ctx)
}
