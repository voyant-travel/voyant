import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"

const startHandler = createStartHandler(defaultStreamHandler)

let apiAppPromise: Promise<typeof import("./api/app")["app"]> | undefined
function loadApiApp(): Promise<typeof import("./api/app")["app"]> {
  apiAppPromise ??= import("./api/app").then((mod) => mod.app)
  return apiAppPromise
}

export default {
  async fetch(request: Request, env: CloudflareBindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Route /api/* to Hono (strip prefix so Hono sees /v1/*, /auth/*, /health)
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const stripped = url.pathname.slice(4) || "/"
      const apiUrl = new URL(stripped, url.origin)
      apiUrl.search = url.search
      const apiRequest = new Request(apiUrl.toString(), request)
      const apiApp = await loadApiApp()
      return apiApp.fetch(apiRequest, env, ctx)
    }

    // Everything else → TanStack Start SSR
    return startHandler(request)
  },
}
