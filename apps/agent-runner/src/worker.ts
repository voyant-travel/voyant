import { createApp, runPersistentSupervisorTick } from "./app.js"
import { AgentRunnerCoordinator } from "./coordinator.js"
import { createD1AgentRunnerLedgerStore } from "./run-ledger-store.js"
import { createR2SupervisorTickStore } from "./supervisor-tick-store.js"

interface Env {
  AGENT_CONTROL_PLANE?: Fetcher
  AGENT_CONTROL_PLANE_TOKEN?: string
  AGENT_CONTROL_PLANE_URL?: string
  AGENT_RUNNER_ACTION?: string
  AGENT_RUNNER_ALLOWED_ACTIONS?: string
  AGENT_RUNNER_COORDINATOR?: DurableObjectNamespace
  AGENT_RUNNER_DB?: D1Database
  AGENT_RUNNER_ENABLED?: string
  AGENT_RUNNER_HOLDER?: string
  AGENT_RUNNER_MAX_DAILY_LEASES?: string
  AGENT_RUNNER_MAX_LEASE_TTL_SECONDS?: string
  AGENT_RUNNER_REPOSITORY?: string
  AGENT_RUNNER_TICK_KEY_PREFIX?: string
  AGENT_RUNNER_TICKS?: R2Bucket
  AGENT_RUNNER_TOKENS?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp({
      authTokens: parseTokens(env.AGENT_RUNNER_TOKENS),
      config: runnerConfigFromEnv(env),
      coordinatorConfigured: Boolean(env.AGENT_RUNNER_COORDINATOR),
      runLedgerStore: runLedgerStoreFromEnv(env),
      supervisorTickStore: supervisorTickStoreFromEnv(env),
    })
    return await app.fetch(request)
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const tick = await runPersistentSupervisorTick({
      config: runnerConfigFromEnv(env),
      request: {
        dryRun: env.AGENT_RUNNER_ENABLED !== "true",
        reason: "cloudflare-cron",
      },
      runLedgerStore: runLedgerStoreFromEnv(env),
      source: "scheduled",
      supervisorTickStore: supervisorTickStoreFromEnv(env),
    })
    console.log(
      JSON.stringify({
        service: "agent-runner",
        storage: tick.storage,
        supervisorTick: tick.result,
      }),
    )
  },
} satisfies ExportedHandler<Env>

export { AgentRunnerCoordinator }

function runnerConfigFromEnv(env: Env) {
  return {
    allowedActions: parseList(env.AGENT_RUNNER_ALLOWED_ACTIONS),
    controlPlaneConfigured: Boolean(
      (env.AGENT_CONTROL_PLANE || env.AGENT_CONTROL_PLANE_URL) && env.AGENT_CONTROL_PLANE_TOKEN,
    ),
    controlPlaneService: env.AGENT_CONTROL_PLANE,
    controlPlaneToken: env.AGENT_CONTROL_PLANE_TOKEN,
    controlPlaneUrl: env.AGENT_CONTROL_PLANE_URL,
    defaultAction: env.AGENT_RUNNER_ACTION,
    enabled: env.AGENT_RUNNER_ENABLED === "true",
    holder: env.AGENT_RUNNER_HOLDER,
    maxDailyLeases: parsePositiveInteger(env.AGENT_RUNNER_MAX_DAILY_LEASES),
    maxLeaseTtlSeconds: parsePositiveInteger(env.AGENT_RUNNER_MAX_LEASE_TTL_SECONDS),
    repository: env.AGENT_RUNNER_REPOSITORY,
  }
}

function supervisorTickStoreFromEnv(env: Env) {
  return env.AGENT_RUNNER_TICKS
    ? createR2SupervisorTickStore({
        bucket: env.AGENT_RUNNER_TICKS,
        keyPrefix: env.AGENT_RUNNER_TICK_KEY_PREFIX,
      })
    : undefined
}

function runLedgerStoreFromEnv(env: Env) {
  return env.AGENT_RUNNER_DB
    ? createD1AgentRunnerLedgerStore({
        database: env.AGENT_RUNNER_DB,
      })
    : undefined
}

function parseTokens(value: string | undefined) {
  return parseList(value)
}

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) return undefined

  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : undefined
}
