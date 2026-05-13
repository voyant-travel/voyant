import { Hono } from "hono"

import {
  buildRunnerCapabilities,
  planSupervisorTick,
  type RunnerConfig,
  runSupervisorTick,
  type SupervisorTickRequest,
  supervisorTickRequestSchema,
} from "./runner.js"
import {
  createSupervisorTickRecord,
  type SupervisorLeaseRecord,
  type SupervisorTickStore,
} from "./supervisor-tick-store.js"

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
      supervisorTicks: supervisorTickCapabilities(supervisorTickStore),
    }),
  )

  app.get("/api/supervisor/status", async (c) => {
    const repository = c.req.query("repository")?.trim() || config.repository
    if (!repository) {
      return c.json({ error: "missing_repository" }, 400)
    }

    const capabilities = {
      ...buildRunnerCapabilities(config),
      supervisorTicks: supervisorTickCapabilities(supervisorTickStore),
    }

    if (!supervisorTickStore) {
      return c.json({
        capabilities,
        repository,
        service: "agent-runner",
        supervisorTicks: {
          latest: null,
          recent: [],
          storage: {
            configured: false,
            persistence: "none",
          },
        },
      })
    }

    return c.json({
      capabilities,
      repository,
      service: "agent-runner",
      supervisorTicks: {
        latest: await supervisorTickStore.getLatest(repository),
        recent: await supervisorTickStore.listRecent(repository, {
          limit: parseLimit(c.req.query("limit")) ?? 5,
        }),
        storage: {
          configured: true,
          persistence: "latest",
        },
      },
    })
  })

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

    return c.json(
      await runPersistentSupervisorTick({
        config,
        fetchImpl,
        now,
        request: parsed.data,
        source: "api",
        supervisorTickStore,
      }),
    )
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

export async function runPersistentSupervisorTick({
  config,
  fetchImpl = fetch,
  now = () => new Date(),
  request = {},
  source,
  supervisorTickStore,
}: {
  config: RunnerConfig
  fetchImpl?: typeof fetch
  now?: () => Date
  request?: SupervisorTickRequest
  source: "api" | "scheduled"
  supervisorTickStore?: SupervisorTickStore
}) {
  const recordedAt = now()
  const budget = await evaluateSupervisorLeaseBudget({
    config,
    recordedAt,
    request,
    supervisorTickStore,
  })
  let result = budget.blocked
    ? {
        budget,
        leased: false,
        plan: planSupervisorTick({ config, request, source }),
        reason: "lease_budget_exhausted",
      }
    : budget.configured
      ? {
          ...(await runSupervisorTick({
            config,
            fetchImpl,
            request,
            source,
          })),
          budget,
        }
      : await runSupervisorTick({
          config,
          fetchImpl,
          request,
          source,
        })
  const repository = request.repository ?? config.repository
  if (
    budget.configured &&
    "usedLeases" in budget &&
    "maxDailyLeases" in budget &&
    !budget.blocked &&
    repository &&
    isLeasedResult(result)
  ) {
    await supervisorTickStore?.putLease?.(
      createSupervisorLeaseRecord({
        leasedAt: recordedAt,
        repository,
        result,
      }),
    )
    const usedLeases = budget.usedLeases + 1
    result = {
      ...result,
      budget: {
        ...budget,
        remainingLeases: Math.max(budget.maxDailyLeases - usedLeases, 0),
        usedLeases,
      },
    }
  }
  const storage = await persistSupervisorTick({
    recordedAt,
    repository,
    result,
    supervisorTickStore,
  })

  return {
    plannedAt: recordedAt.toISOString(),
    result,
    storage,
  }
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

async function evaluateSupervisorLeaseBudget({
  config,
  recordedAt,
  request,
  supervisorTickStore,
}: {
  config: RunnerConfig
  recordedAt: Date
  request: SupervisorTickRequest
  supervisorTickStore?: SupervisorTickStore
}) {
  const maxDailyLeases = normalizeDailyLeaseLimit(config.maxDailyLeases)
  if (!maxDailyLeases) {
    return { blocked: false, configured: false }
  }

  const repository = request.repository ?? config.repository
  const dryRun = request.dryRun ?? true
  const windowStartedAt = new Date(recordedAt.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const base = {
    blocked: false,
    configured: true,
    maxDailyLeases,
    remainingLeases: maxDailyLeases,
    usedLeases: 0,
    windowStartedAt,
  }

  if (dryRun || !config.enabled) {
    return base
  }

  if (!repository) {
    return base
  }

  if (!supervisorTickStore?.listLeases || !supervisorTickStore.putLease) {
    return {
      ...base,
      blocked: true,
      reason: "lease budget requires supervisor lease history storage",
      remainingLeases: 0,
    }
  }

  const recentLeases = await supervisorTickStore.listLeases(repository, { since: windowStartedAt })
  const usedLeases = recentLeases.length
  const remainingLeases = Math.max(maxDailyLeases - usedLeases, 0)

  return {
    ...base,
    blocked: usedLeases >= maxDailyLeases,
    remainingLeases,
    usedLeases,
    ...(usedLeases >= maxDailyLeases ? { reason: "daily lease budget exhausted" } : {}),
  }
}

function normalizeDailyLeaseLimit(value: number | undefined) {
  if (!value) return null
  return Math.min(Math.max(Math.trunc(value), 1), 100)
}

function isLeasedResult(result: unknown): result is { leased: true } {
  return Boolean(
    result && typeof result === "object" && "leased" in result && result.leased === true,
  )
}

function createSupervisorLeaseRecord({
  leasedAt,
  repository,
  result,
}: {
  leasedAt: Date
  repository: string
  result: unknown
}): SupervisorLeaseRecord {
  return {
    id: leaseRecordId(leasedAt),
    leasedAt: leasedAt.toISOString(),
    repository,
    result,
  }
}

function leaseRecordId(leasedAt: Date) {
  return `lease_${leasedAt.getTime()}_${Math.random().toString(36).slice(2)}`
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

function supervisorTickCapabilities(supervisorTickStore: SupervisorTickStore | undefined) {
  return {
    history: Boolean(supervisorTickStore),
    leaseBudgetHistory: Boolean(supervisorTickStore?.listLeases && supervisorTickStore.putLease),
    persistence: supervisorTickStore ? "latest" : "none",
  }
}
