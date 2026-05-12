import { Hono } from "hono"

import {
  acceptTickSnapshot,
  buildCapabilities,
  dispatchPlanRequestSchema,
  selectDispatchPlan,
  tickSnapshotRequestSchema,
} from "./control-plane.js"

interface AppOptions {
  authTokens?: string[]
}

export function createApp({ authTokens = [] }: AppOptions = {}): Hono {
  const app = new Hono()

  app.onError((error, c) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[agent-control-plane] ${c.req.method} ${c.req.path}: ${message}`)
    return c.json({ error: "internal_error" }, 500)
  })

  app.get("/health", (c) => c.json({ ok: true, service: "agent-control-plane" }))

  app.use("/api/*", async (c, next) => {
    if (authTokens.length === 0) {
      return c.json({ error: "control_plane_auth_not_configured" }, 503)
    }

    const token = bearerToken(c.req.header("authorization"))
    if (!token || !authTokens.includes(token)) {
      return c.json({ error: "unauthorized" }, 401)
    }

    await next()
  })

  app.get("/api/capabilities", (c) => c.json(buildCapabilities()))

  app.post("/api/dispatch-plans", async (c) => {
    const parsed = dispatchPlanRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_dispatch_plan_request",
          issues: validationIssues(parsed.error),
        },
        400,
      )
    }

    return c.json(selectDispatchPlan(parsed.data))
  })

  app.post("/api/tick-snapshots", async (c) => {
    const parsed = tickSnapshotRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_tick_snapshot_request",
          issues: validationIssues(parsed.error),
        },
        400,
      )
    }

    return c.json(acceptTickSnapshot(parsed.data))
  })

  return app
}

function bearerToken(header: string | undefined) {
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim()
}

function validationIssues(error: { issues: Array<{ path: Array<PropertyKey>; message: string }> }) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }))
}
