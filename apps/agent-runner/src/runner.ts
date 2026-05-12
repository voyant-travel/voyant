import { z } from "zod"

export const supervisorTickRequestSchema = z
  .object({
    action: z.string().trim().min(1).optional(),
    dryRun: z.boolean().optional(),
    eventLog: z.string().trim().min(1).optional(),
    holder: z.string().trim().min(1).optional(),
    issue: z.number().int().positive().optional(),
    iterations: z.number().int().positive().max(100).optional(),
    repository: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1).optional(),
    ttlSeconds: z.number().int().min(60).max(3600).optional(),
    updateBody: z.boolean().optional(),
  })
  .strict()

export type SupervisorTickRequest = z.infer<typeof supervisorTickRequestSchema>

export interface RunnerConfig {
  controlPlaneConfigured: boolean
  controlPlaneToken?: string
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
      mode: config.enabled ? "lease-only" : "disabled",
      reason: config.enabled
        ? "runner can lease dispatch intents; command execution remains external"
        : "runner execution is disabled until credentials, queue budget, and policy are configured",
    },
    controlPlane: {
      configured: config.controlPlaneConfigured,
      tokenConfigured: Boolean(config.controlPlaneToken),
      url: config.controlPlaneUrl ?? null,
    },
    defaults: {
      holder: config.holder ?? null,
      repository: config.repository ?? null,
    },
    scheduler: {
      cronCompatible: true,
      mode: "lease-only",
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
    mode: "lease-only",
    source,
  }
}

export async function runSupervisorTick({
  config,
  fetchImpl = fetch,
  request = {},
  source,
}: {
  config: RunnerConfig
  fetchImpl?: typeof fetch
  request?: SupervisorTickRequest
  source: "api" | "scheduled"
}) {
  const plan = planSupervisorTick({ config, request, source })
  if (!plan.accepted || plan.dryRun) {
    return {
      leased: false,
      plan,
      reason: plan.accepted ? "dry_run" : "blocked",
    }
  }

  if (!config.controlPlaneToken || !config.controlPlaneUrl) {
    return {
      leased: false,
      plan: {
        ...plan,
        accepted: false,
        blockers: [...plan.blockers, "control plane credentials are incomplete"],
      },
      reason: "blocked",
    }
  }

  const response = await fetchImpl(
    `${normalizeControlPlaneUrl(config.controlPlaneUrl)}/api/dispatch-intents/latest`,
    {
      body: JSON.stringify(buildDispatchIntentRequest({ config, request })),
      headers: {
        authorization: `Bearer ${config.controlPlaneToken}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  )
  const bodyText = await response.text()
  const body = parseJsonBody(bodyText)

  if (!response.ok) {
    return {
      controlPlane: {
        error: body?.error ?? bodyText,
        status: response.status,
      },
      leased: false,
      plan,
      reason: "control_plane_rejected",
    }
  }

  return {
    controlPlane: {
      status: response.status,
    },
    intent: body?.intent ?? null,
    leased: Boolean(body?.intent),
    plan,
    reason: body?.reason ?? (body?.intent ? "leased" : "no_intent"),
  }
}

function buildDispatchIntentRequest({
  config,
  request,
}: {
  config: RunnerConfig
  request: SupervisorTickRequest
}) {
  const holder = request.holder ?? config.holder
  const repository = request.repository ?? config.repository

  return {
    repository,
    lease: {
      holder,
      ...(request.ttlSeconds ? { ttlSeconds: request.ttlSeconds } : {}),
    },
    ...(request.action || request.issue
      ? {
          filters: {
            ...(request.action ? { action: request.action } : {}),
            ...(request.issue ? { issueNumber: request.issue } : {}),
          },
        }
      : {}),
    ...(request.eventLog || request.updateBody
      ? {
          options: {
            ...(request.eventLog ? { eventLog: request.eventLog } : {}),
            ...(request.updateBody ? { updateBody: true } : {}),
          },
        }
      : {}),
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

function normalizeControlPlaneUrl(url: string) {
  return url.replace(/\/+$/, "")
}

function parseJsonBody(bodyText: string) {
  if (!bodyText) return null

  try {
    return JSON.parse(bodyText)
  } catch {
    return null
  }
}
