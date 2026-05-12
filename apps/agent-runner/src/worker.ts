import { createApp } from "./app.js"
import { runSupervisorTick } from "./runner.js"

interface Env {
  AGENT_CONTROL_PLANE_TOKEN?: string
  AGENT_CONTROL_PLANE_URL?: string
  AGENT_RUNNER_ENABLED?: string
  AGENT_RUNNER_HOLDER?: string
  AGENT_RUNNER_REPOSITORY?: string
  AGENT_RUNNER_TOKENS?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp({
      authTokens: parseTokens(env.AGENT_RUNNER_TOKENS),
      config: runnerConfigFromEnv(env),
    })
    return await app.fetch(request)
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const result = await runSupervisorTick({
      config: runnerConfigFromEnv(env),
      request: {
        dryRun: env.AGENT_RUNNER_ENABLED !== "true",
        reason: "cloudflare-cron",
      },
      source: "scheduled",
    })
    console.log(JSON.stringify({ service: "agent-runner", supervisorTick: result }))
  },
} satisfies ExportedHandler<Env>

function runnerConfigFromEnv(env: Env) {
  return {
    controlPlaneConfigured: Boolean(env.AGENT_CONTROL_PLANE_URL && env.AGENT_CONTROL_PLANE_TOKEN),
    controlPlaneToken: env.AGENT_CONTROL_PLANE_TOKEN,
    controlPlaneUrl: env.AGENT_CONTROL_PLANE_URL,
    enabled: env.AGENT_RUNNER_ENABLED === "true",
    holder: env.AGENT_RUNNER_HOLDER,
    repository: env.AGENT_RUNNER_REPOSITORY,
  }
}

function parseTokens(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}
