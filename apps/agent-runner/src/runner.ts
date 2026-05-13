import { z } from "zod"
import {
  acquireRemoteWorkspaceSlot,
  type RemoteWorkspacePool,
  type RemoteWorkspaceSlotLease,
  releaseRemoteWorkspaceSlot,
} from "./remote-workspace-pool.js"

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

type ControlPlaneService = Pick<Fetcher, "fetch">
type CoordinatorService = Pick<Fetcher, "fetch">

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
  controlPlaneService?: ControlPlaneService
  controlPlaneToken?: string
  controlPlaneUrl?: string
  defaultAction?: string
  enabled: boolean
  holder?: string
  leaseTtlSeconds?: number
  maxDailyLeases?: number
  maxLeaseTtlSeconds?: number
  remoteWorkspacePool?: RemoteWorkspacePool
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
      serviceBinding: Boolean(config.controlPlaneService),
      tokenConfigured: Boolean(config.controlPlaneToken),
      url: config.controlPlaneUrl ?? null,
    },
    defaults: {
      action: config.defaultAction ?? null,
      holder: config.holder ?? null,
      leaseTtlSeconds: config.leaseTtlSeconds ?? null,
      repository: config.repository ?? null,
    },
    policy: buildRunnerPolicy(config),
    remoteWorkspacePool: {
      configured: Boolean(config.remoteWorkspacePool?.configured),
      provider: config.remoteWorkspacePool?.provider ?? null,
      slots: config.remoteWorkspacePool?.slots.length ?? 0,
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
  const policy = buildRunnerPolicy(config)
  const action = request.action ?? config.defaultAction
  const ttlSeconds = request.ttlSeconds ?? config.leaseTtlSeconds

  const blockers = [
    config.enabled ? null : "runner execution is disabled",
    config.controlPlaneConfigured ? null : "control plane is not configured",
    holder ? null : "holder is not configured",
    repository ? null : "repository is not configured",
    actionPolicyBlocker({ action, policy }),
    ttlPolicyBlocker({ policy, ttlSeconds }),
  ].filter((blocker): blocker is string => Boolean(blocker))

  return {
    accepted: blockers.length === 0,
    blockers,
    command: buildLocalEquivalentCommand({
      controlPlaneUrl: config.controlPlaneUrl,
      holder,
      iterations,
      repository,
      ttlSeconds,
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
  coordinatorService,
  fetchImpl = fetch,
  request = {},
  source,
}: {
  config: RunnerConfig
  coordinatorService?: CoordinatorService
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

  if (!config.controlPlaneToken || (!config.controlPlaneService && !config.controlPlaneUrl)) {
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

  const workspaceLease = await maybeAcquireRemoteWorkspaceSlot({
    config,
    coordinatorService,
    request,
  })
  if (workspaceLease.blocked) {
    return {
      leased: false,
      plan,
      reason: workspaceLease.reason,
      remoteWorkspacePool: workspaceLease.remoteWorkspacePool,
    }
  }

  const response = await requestControlPlane({
    body: buildDispatchIntentRequest({
      config,
      remoteWorkspace: workspaceLease.lease?.slot.workspaceReference,
      request,
    }),
    config,
    fetchImpl,
    path: "/api/dispatch-intents/latest",
  })
  const bodyText = await response.text()
  const body = parseJsonBody(bodyText)

  if (!response.ok) {
    await releaseRemoteWorkspaceSlot({
      coordinator: coordinatorService,
      holder: request.holder ?? config.holder ?? "",
      lease: workspaceLease.lease,
    })
    return {
      controlPlane: {
        ...(body?.intent ? { activeIntent: body.intent } : {}),
        error: body?.error ?? bodyText,
        status: response.status,
      },
      leased: false,
      plan,
      reason: "control_plane_rejected",
      ...(workspaceLease.lease ? { remoteWorkspaceLease: workspaceLease.lease } : {}),
    }
  }

  if (!body?.intent) {
    await releaseRemoteWorkspaceSlot({
      coordinator: coordinatorService,
      holder: request.holder ?? config.holder ?? "",
      lease: workspaceLease.lease,
    })
  }

  return {
    controlPlane: {
      status: response.status,
    },
    intent: body?.intent ?? null,
    leased: Boolean(body?.intent),
    plan,
    reason: body?.reason ?? (body?.intent ? "leased" : "no_intent"),
    ...(workspaceLease.lease ? { remoteWorkspaceLease: workspaceLease.lease } : {}),
  }
}

async function maybeAcquireRemoteWorkspaceSlot({
  config,
  coordinatorService,
  request,
}: {
  config: RunnerConfig
  coordinatorService?: CoordinatorService
  request: SupervisorTickRequest
}): Promise<
  | { blocked: false; lease?: RemoteWorkspaceSlotLease }
  | {
      blocked: true
      reason: "remote_workspace_pool_full" | "remote_workspace_pool_not_configured"
      remoteWorkspacePool: { configured: boolean; slots: number }
    }
> {
  if (!usesRemoteWorkspacePool({ config, request })) {
    return { blocked: false }
  }

  const holder = request.holder ?? config.holder
  if (!holder) {
    return { blocked: false }
  }

  const ttlSeconds = request.ttlSeconds ?? config.leaseTtlSeconds ?? 900
  const acquired = await acquireRemoteWorkspaceSlot({
    coordinator: coordinatorService,
    holder,
    pool: config.remoteWorkspacePool,
    ttlSeconds,
  })
  if (acquired.acquired) {
    return { blocked: false, lease: acquired.lease }
  }

  const remoteWorkspacePool = {
    configured: Boolean(config.remoteWorkspacePool?.configured),
    slots: config.remoteWorkspacePool?.slots.length ?? 0,
  }

  return {
    blocked: true,
    reason:
      acquired.reason === "pool_full"
        ? "remote_workspace_pool_full"
        : "remote_workspace_pool_not_configured",
    remoteWorkspacePool,
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
  const response = await requestControlPlane({
    body: buildDispatchPlanRequest({ config, request }),
    config,
    fetchImpl,
    path: "/api/dispatch-plans/latest",
  })
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

async function requestControlPlane({
  body,
  config,
  fetchImpl,
  path,
}: {
  body: unknown
  config: RunnerConfig
  fetchImpl: typeof fetch
  path: string
}) {
  const init = {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${config.controlPlaneToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  }

  if (config.controlPlaneService) {
    return await config.controlPlaneService.fetch(
      new Request(`https://agent-control-plane.internal${path}`, init),
    )
  }

  return await fetchImpl(`${normalizeControlPlaneUrl(config.controlPlaneUrl ?? "")}${path}`, init)
}

function buildDispatchPlanRequest({
  config,
  remoteWorkspace,
  request,
}: {
  config: RunnerConfig
  remoteWorkspace?: string
  request: SupervisorTickRequest
}) {
  const repository = request.repository ?? config.repository
  const action = request.action ?? config.defaultAction
  const filterAction = remoteWorkspace && action === "remote-bootstrap" ? "start" : action

  return {
    repository,
    ...(filterAction || request.issue
      ? {
          filters: {
            ...(filterAction ? { action: filterAction } : {}),
            ...(request.issue ? { issueNumber: request.issue } : {}),
          },
        }
      : {}),
    ...(request.eventLog || request.updateBody || remoteWorkspace
      ? {
          options: {
            ...(request.eventLog ? { eventLog: request.eventLog } : {}),
            ...(remoteWorkspace ? { remoteWorkspace } : {}),
            ...(request.updateBody ? { updateBody: true } : {}),
          },
        }
      : {}),
  }
}

function buildDispatchIntentRequest({
  config,
  remoteWorkspace,
  request,
}: {
  config: RunnerConfig
  remoteWorkspace?: string
  request: SupervisorTickRequest
}) {
  const holder = request.holder ?? config.holder
  const repository = request.repository ?? config.repository
  const action = request.action ?? config.defaultAction
  const filterAction = remoteWorkspace && action === "remote-bootstrap" ? "start" : action
  const ttlSeconds = request.ttlSeconds ?? config.leaseTtlSeconds

  return {
    repository,
    lease: {
      holder,
      ...(ttlSeconds ? { ttlSeconds } : {}),
    },
    ...(filterAction || request.issue
      ? {
          filters: {
            ...(filterAction ? { action: filterAction } : {}),
            ...(request.issue ? { issueNumber: request.issue } : {}),
          },
        }
      : {}),
    ...(request.eventLog || request.updateBody || remoteWorkspace
      ? {
          options: {
            ...(request.eventLog ? { eventLog: request.eventLog } : {}),
            ...(remoteWorkspace ? { remoteWorkspace } : {}),
            ...(request.updateBody ? { updateBody: true } : {}),
          },
        }
      : {}),
  }
}

function usesRemoteWorkspacePool({
  config,
  request,
}: {
  config: RunnerConfig
  request: SupervisorTickRequest
}) {
  if (!config.remoteWorkspacePool?.configured) return false
  return (request.action ?? config.defaultAction) === "remote-bootstrap"
}

function buildRunnerPolicy(config: RunnerConfig) {
  const configuredAllowedActions = normalizeConfiguredAllowedActions(config.allowedActions)
  const allowedActions = configuredAllowedActions ?? Array.from(runnerDefaultDispatchActions).sort()
  const maxDailyLeases = normalizeMaxDailyLeases(config.maxDailyLeases)
  const maxLeaseTtlSeconds = normalizeMaxLeaseTtlSeconds(config.maxLeaseTtlSeconds)
  const restrictsActions = configuredAllowedActions
    ? runnerDispatchActions.some((action) => !allowedActions.includes(action))
    : false

  return {
    allowedActions,
    defaultAction: config.defaultAction ?? null,
    maxDailyLeases,
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

function normalizeMaxDailyLeases(value: number | undefined) {
  if (!value) return null
  return Math.min(Math.max(Math.trunc(value), 1), 100)
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
  ttlSeconds,
}: {
  controlPlaneUrl?: string
  holder?: string
  iterations: number
  repository?: string
  ttlSeconds?: number
}) {
  const command = ["pnpm", "agent:queue:control-plane-loop", "--"]
  if (repository) {
    command.push("--repo", repository)
  }
  if (holder) {
    command.push("--holder", holder)
  }
  command.push("--iterations", String(iterations), "--yes")
  if (ttlSeconds) {
    command.push("--ttl-seconds", String(ttlSeconds))
  }
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
