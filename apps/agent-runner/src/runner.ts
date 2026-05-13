import { z } from "zod"

export const runnerDispatchActions = [
  "collect-ci",
  "collect-review",
  "complete-pr",
  "cleanup",
  "open-pr",
  "publish-evidence",
  "remote-bootstrap",
  "remote-cleanup",
  "remote-open-pr",
  "remote-publish-evidence",
  "remote-repair-ci",
  "repair-ci",
  "start",
  "sync-pr",
] as const

const runnerOptInDispatchActions = new Set<string>(["remote-repair-ci", "repair-ci"])
export const runnerDefaultDispatchActions = runnerDispatchActions.filter(
  (action) => !runnerOptInDispatchActions.has(action),
)
const runnerDispatchActionSet = new Set<string>(runnerDispatchActions)

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
    validateControlPlane: z.boolean().optional(),
  })
  .strict()

export type SupervisorTickRequest = z.infer<typeof supervisorTickRequestSchema>

export interface RunnerConfig {
  allowedActions?: string[]
  controlPlaneConfigured: boolean
  controlPlaneToken?: string
  controlPlaneUrl?: string
  defaultAction?: string
  enabled: boolean
  holder?: string
  maxLeaseTtlSeconds?: number
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
      action: config.defaultAction ?? null,
      holder: config.holder ?? null,
      repository: config.repository ?? null,
    },
    policy: buildRunnerPolicy(config),
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
  const policy = buildRunnerPolicy(config)
  const action = request.action ?? config.defaultAction

  const blockers = [
    config.enabled ? null : "runner execution is disabled",
    config.controlPlaneConfigured ? null : "control plane is not configured",
    holder ? null : "holder is not configured",
    repository ? null : "repository is not configured",
    actionPolicyBlocker({ action, policy }),
    ttlPolicyBlocker({ policy, ttlSeconds: request.ttlSeconds }),
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
    policy,
    source,
    ...(request.validateControlPlane ? { validatesControlPlane: true } : {}),
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
  if (!plan.accepted) {
    return {
      leased: false,
      plan,
      reason: "blocked",
    }
  }

  if (plan.dryRun && !request.validateControlPlane) {
    return {
      leased: false,
      plan,
      reason: "dry_run",
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

  if (plan.dryRun) {
    return await validateControlPlaneDispatchPlan({
      config,
      fetchImpl,
      plan,
      request,
    })
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
        ...(body?.intent ? { activeIntent: body.intent } : {}),
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

async function validateControlPlaneDispatchPlan({
  config,
  fetchImpl,
  plan,
  request,
}: {
  config: RunnerConfig
  fetchImpl: typeof fetch
  plan: ReturnType<typeof planSupervisorTick>
  request: SupervisorTickRequest
}) {
  const response = await fetchImpl(
    `${normalizeControlPlaneUrl(config.controlPlaneUrl ?? "")}/api/dispatch-plans/latest`,
    {
      body: JSON.stringify(buildDispatchPlanRequest({ config, request })),
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
    dispatchPlan: body?.plan ?? null,
    leased: false,
    plan,
    reason: "dry_run",
  }
}

function buildDispatchPlanRequest({
  config,
  request,
}: {
  config: RunnerConfig
  request: SupervisorTickRequest
}) {
  const repository = request.repository ?? config.repository
  const action = request.action ?? config.defaultAction

  return {
    repository,
    ...(action || request.issue
      ? {
          filters: {
            ...(action ? { action } : {}),
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

function buildDispatchIntentRequest({
  config,
  request,
}: {
  config: RunnerConfig
  request: SupervisorTickRequest
}) {
  const holder = request.holder ?? config.holder
  const repository = request.repository ?? config.repository
  const action = request.action ?? config.defaultAction

  return {
    repository,
    lease: {
      holder,
      ...(request.ttlSeconds ? { ttlSeconds: request.ttlSeconds } : {}),
    },
    ...(action || request.issue
      ? {
          filters: {
            ...(action ? { action } : {}),
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

function buildRunnerPolicy(config: RunnerConfig) {
  const configuredAllowedActions = normalizeConfiguredAllowedActions(config.allowedActions)
  const allowedActions = configuredAllowedActions ?? Array.from(runnerDefaultDispatchActions).sort()
  const maxLeaseTtlSeconds = normalizeMaxLeaseTtlSeconds(config.maxLeaseTtlSeconds)
  const restrictsActions = configuredAllowedActions
    ? runnerDispatchActions.some((action) => !allowedActions.includes(action))
    : false

  return {
    allowedActions,
    defaultAction: config.defaultAction ?? null,
    maxLeaseTtlSeconds,
    requiresActionFilter: restrictsActions,
  }
}

function normalizeConfiguredAllowedActions(allowedActions: string[] | undefined) {
  if (!allowedActions?.length) return null

  const normalized = allowedActions
    .map((action) => action.trim())
    .filter((action) => action.length > 0)

  return Array.from(new Set(normalized)).sort()
}

function normalizeMaxLeaseTtlSeconds(value: number | undefined) {
  if (!value) return 900
  return Math.min(Math.max(value, 60), 3600)
}

function actionPolicyBlocker({
  action,
  policy,
}: {
  action?: string
  policy: ReturnType<typeof buildRunnerPolicy>
}) {
  if (action && !runnerDispatchActionSet.has(action)) {
    return `action ${action} is not dispatchable`
  }

  if (action && !policy.allowedActions.includes(action)) {
    return `action ${action} is not allowed by runner policy`
  }

  if (!action && policy.requiresActionFilter) {
    return "runner policy requires an action filter"
  }

  return null
}

function ttlPolicyBlocker({
  policy,
  ttlSeconds,
}: {
  policy: ReturnType<typeof buildRunnerPolicy>
  ttlSeconds?: number
}) {
  if (ttlSeconds && ttlSeconds > policy.maxLeaseTtlSeconds) {
    return `lease TTL ${ttlSeconds}s exceeds runner policy maximum ${policy.maxLeaseTtlSeconds}s`
  }

  return null
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
