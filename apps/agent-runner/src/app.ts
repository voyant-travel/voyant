import { Hono } from "hono"

import {
  buildRunnerCapabilities,
  type RunnerConfig,
  runSupervisorTick,
  supervisorTickRequestSchema,
} from "./runner.js"

interface AppOptions {
  authTokens?: string[]
  config?: RunnerConfig
  fetchImpl?: typeof fetch
  now?: () => Date
}

export function createApp({
  authTokens = [],
  config = {
    controlPlaneConfigured: false,
    enabled: false,
  },
  fetchImpl = fetch,
  now = () => new Date(),
}: AppOptions = {}): Hono {
  const app = new Hono()

  app.onError((error, c) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[agent-runner] ${c.req.method} ${c.req.path}: ${message}`)
    return c.json({ error: "internal_error" }, 500)
  })

  app.get("/health", (c) => c.json({ ok: true, service: "agent-runner" }))

  app.use("/api/*", async (c, next) => {
    if (authTokens.length === 0) {
      return c.json({ error: "runner_auth_not_configured" }, 503)
    }

    const token = bearerToken(c.req.header("authorization"))
    if (!token || !authTokens.includes(token)) {
      return c.json({ error: "unauthorized" }, 401)
    }

    await next()
  })

  app.get("/api/capabilities", (c) => c.json(buildRunnerCapabilities(config)))

  app.post("/api/supervisor/ticks", async (c) => {
    const parsed = supervisorTickRequestSchema.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_supervisor_tick_request",
          issues: validationIssues(parsed.error),
        },
        400,
      )
    }

    return c.json({
      plannedAt: now().toISOString(),
      result: await runSupervisorTick({
        config,
        fetchImpl,
        request: parsed.data,
        source: "api",
      }),
    })
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
