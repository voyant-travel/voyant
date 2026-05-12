import { Hono } from "hono"

import {
  buildRunnerCapabilities,
  type RunnerConfig,
  runSupervisorTick,
  supervisorTickRequestSchema,
} from "./runner.js"
import { createSupervisorTickRecord, type SupervisorTickStore } from "./supervisor-tick-store.js"

interface AppOptions {
  authTokens?: string[]
  config?: RunnerConfig
  fetchImpl?: typeof fetch
  now?: () => Date
  supervisorTickStore?: SupervisorTickStore
}

export function createApp({
  authTokens = [],
  config = {
    controlPlaneConfigured: false,
    enabled: false,
  },
  fetchImpl = fetch,
  now = () => new Date(),
  supervisorTickStore,
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

  app.get("/api/capabilities", (c) =>
    c.json({
      ...buildRunnerCapabilities(config),
      supervisorTicks: {
        history: Boolean(supervisorTickStore),
        persistence: supervisorTickStore ? "latest" : "none",
      },
    }),
  )

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

    const recordedAt = now()
    const result = await runSupervisorTick({
      config,
      fetchImpl,
      request: parsed.data,
      source: "api",
    })
    const repository = parsed.data.repository ?? config.repository
    const storage = await persistSupervisorTick({
      recordedAt,
      repository,
      result,
      supervisorTickStore,
    })

    return c.json({
      plannedAt: recordedAt.toISOString(),
      result,
      storage,
    })
  })

  app.get("/api/supervisor/ticks/latest", async (c) => {
    if (!supervisorTickStore) {
      return c.json({ error: "supervisor_tick_storage_not_configured" }, 503)
    }

    const repository = c.req.query("repository")?.trim()
    if (!repository) {
      return c.json({ error: "missing_repository" }, 400)
    }

    const record = await supervisorTickStore.getLatest(repository)
    if (!record) {
      return c.json({ error: "supervisor_tick_not_found" }, 404)
    }

    return c.json(record)
  })

  app.get("/api/supervisor/ticks/recent", async (c) => {
    if (!supervisorTickStore) {
      return c.json({ error: "supervisor_tick_storage_not_configured" }, 503)
    }

    const repository = c.req.query("repository")?.trim()
    if (!repository) {
      return c.json({ error: "missing_repository" }, 400)
    }

    return c.json({
      records: await supervisorTickStore.listRecent(repository, {
        limit: parseLimit(c.req.query("limit")),
      }),
      repository,
    })
  })

  return app
}

export async function persistSupervisorTick({
  recordedAt,
  repository,
  result,
  supervisorTickStore,
}: {
  recordedAt: Date
  repository?: string
  result: unknown
  supervisorTickStore?: SupervisorTickStore
}) {
  if (!supervisorTickStore) {
    return { persisted: false, reason: "supervisor_tick_storage_not_configured" }
  }

  if (!repository) {
    return { persisted: false, reason: "missing_repository" }
  }

  const write = await supervisorTickStore.putLatest(
    createSupervisorTickRecord({
      recordedAt,
      repository,
      result,
    }),
  )

  return { key: write.key, persisted: true }
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

function parseLimit(value: string | undefined) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
