import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { app as apiApp } from "./api/app"
import { runScheduledChannelPushReconciler } from "./api/channel-push-scheduled"

const startHandler = createStartHandler(defaultStreamHandler)

export default {
  async fetch(request: Request, env: CloudflareBindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Route /api/* to Hono (strip prefix so Hono sees /v1/*, /auth/*, /health)
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const stripped = url.pathname.slice(4) || "/"
      const apiUrl = new URL(stripped, url.origin)
      apiUrl.search = url.search
      const apiRequest = new Request(apiUrl.toString(), request)
      return apiApp.fetch(apiRequest, env, ctx)
    }

    // Everything else → TanStack Start SSR
    return startHandler(request)
  },

  // Cloudflare Workers cron entrypoint. Triggers are declared in
  // wrangler.jsonc; the channel-push reconciler picks the right scanner
  // based on `event.cron`.
  async scheduled(
    event: ScheduledController,
    env: CloudflareBindings,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runScheduledChannelPushReconciler(event, env))
  },
}
