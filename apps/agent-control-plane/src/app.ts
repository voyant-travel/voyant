import { Hono } from "hono"

import {
  buildCapabilities,
  dispatchPlanRequestSchema,
  selectDispatchPlan,
} from "./control-plane.js"

export function createApp(): Hono {
  const app = new Hono()

  app.onError((error, c) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[agent-control-plane] ${c.req.method} ${c.req.path}: ${message}`)
    return c.json({ error: "internal_error" }, 500)
  })

  app.get("/", (c) => c.json(buildCapabilities()))
  app.get("/health", (c) => c.json({ ok: true, service: "agent-control-plane" }))
  app.get("/api/capabilities", (c) => c.json(buildCapabilities()))

  app.post("/api/dispatch-plans", async (c) => {
    const parsed = dispatchPlanRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_dispatch_plan_request",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      )
    }

    return c.json(selectDispatchPlan(parsed.data))
  })

  return app
}
