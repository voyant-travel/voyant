import { z } from "zod"

export const supervisorTickRequestSchema = z
  .object({
    dryRun: z.boolean().optional(),
    holder: z.string().trim().min(1).optional(),
    iterations: z.number().int().positive().max(100).optional(),
    repository: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1).optional(),
  })
  .strict()

export type SupervisorTickRequest = z.infer<typeof supervisorTickRequestSchema>

export interface RunnerConfig {
  controlPlaneConfigured: boolean
  controlPlaneUrl?: string
  enabled: boolean
  holder?: string
  repository?: string
}

export function buildRunnerCapabilities(config: RunnerConfig) {
  return {
    service: "agent-runner",
    execution: {
      enabled: config.enabled,
      mode: config.enabled ? "supervisor" : "disabled",
      reason: config.enabled
        ? "runner execution is enabled by environment"
        : "runner execution is disabled until credentials, queue budget, and policy are configured",
    },
    controlPlane: {
      configured: config.controlPlaneConfigured,
      url: config.controlPlaneUrl ?? null,
    },
    defaults: {
      holder: config.holder ?? null,
      repository: config.repository ?? null,
    },
    scheduler: {
      cronCompatible: true,
      mutatesByDefault: false,
    },
  }
}

export function planSupervisorTick({
  config,
  request = {},
  source,
}: {
  config: RunnerConfig
  request?: SupervisorTickRequest
  source: "api" | "scheduled"
}) {
  const holder = request.holder ?? config.holder
  const repository = request.repository ?? config.repository
  const iterations = request.iterations ?? 1

  const blockers = [
    config.enabled ? null : "runner execution is disabled",
    config.controlPlaneConfigured ? null : "control plane is not configured",
    holder ? null : "holder is not configured",
    repository ? null : "repository is not configured",
  ].filter((blocker): blocker is string => Boolean(blocker))

  return {
    accepted: blockers.length === 0,
    blockers,
    command: buildLocalEquivalentCommand({
      controlPlaneUrl: config.controlPlaneUrl,
      holder,
      iterations,
      repository,
    }),
    dryRun: request.dryRun ?? true,
    iterations,
    source,
  }
}

function buildLocalEquivalentCommand({
  controlPlaneUrl,
  holder,
  iterations,
  repository,
}: {
  controlPlaneUrl?: string
  holder?: string
  iterations: number
  repository?: string
}) {
  const command = ["pnpm", "agent:queue:control-plane-loop", "--"]
  if (repository) {
    command.push("--repo", repository)
  }
  if (holder) {
    command.push("--holder", holder)
  }
  command.push("--iterations", String(iterations), "--yes")
  if (controlPlaneUrl) {
    command.push("--control-plane-url", controlPlaneUrl)
  }
  return command
}
