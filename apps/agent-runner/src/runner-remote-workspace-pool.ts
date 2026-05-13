import {
  acquireRemoteWorkspaceSlot,
  type RemoteWorkspaceSlotLease,
  releaseRemoteWorkspaceSlot,
} from "./remote-workspace-pool.js"
import type { planSupervisorTick, RunnerConfig, SupervisorTickRequest } from "./runner.js"

type CoordinatorService = Pick<Fetcher, "fetch">

interface DispatchIntentResponse {
  body: Record<string, unknown> | null
  bodyText: string
  ok: boolean
  status: number
}

export async function leaseDispatchIntentWithRemoteWorkspacePool({
  config,
  coordinatorService,
  plan,
  request,
  requestIntent,
}: {
  config: RunnerConfig
  coordinatorService?: CoordinatorService
  plan: ReturnType<typeof planSupervisorTick>
  request: SupervisorTickRequest
  requestIntent: (remoteWorkspace?: string) => Promise<DispatchIntentResponse>
}) {
  const attemptedWorkspaceReferences = new Set<string>()

  for (;;) {
    const workspaceLease = await maybeAcquireRemoteWorkspaceSlot({
      config,
      coordinatorService,
      excludedWorkspaceReferences: attemptedWorkspaceReferences,
      request,
    })
    if (workspaceLease.blocked) {
      return {
        leased: false,
        plan,
        reason: workspaceLease.reason,
        remoteWorkspacePool: {
          ...workspaceLease.remoteWorkspacePool,
          attempted: attemptedWorkspaceReferences.size,
        },
      }
    }

    const result = await requestIntent(workspaceLease.lease?.slot.workspaceReference)
    if (!result.ok) {
      await releaseRemoteWorkspaceSlot({
        coordinator: coordinatorService,
        holder: request.holder ?? config.holder ?? "",
        lease: workspaceLease.lease,
      })
      return {
        controlPlane: {
          ...(result.body?.intent ? { activeIntent: result.body.intent } : {}),
          error: result.body?.error ?? result.bodyText,
          status: result.status,
        },
        leased: false,
        plan,
        reason: "control_plane_rejected",
        ...(workspaceLease.lease ? { remoteWorkspaceLease: workspaceLease.lease } : {}),
      }
    }

    if (result.body?.intent) {
      return {
        controlPlane: {
          status: result.status,
        },
        intent: result.body.intent,
        leased: true,
        plan,
        reason: result.body.reason ?? "leased",
        ...(workspaceLease.lease ? { remoteWorkspaceLease: workspaceLease.lease } : {}),
      }
    }

    const remoteWorkspaceRelease = await releaseRemoteWorkspaceSlot({
      coordinator: coordinatorService,
      holder: request.holder ?? config.holder ?? "",
      lease: workspaceLease.lease,
    })

    const workspaceReference = workspaceLease.lease?.slot.workspaceReference
    if (!workspaceReference || !isRemoteWorkspaceAlreadyAssignedReason(result.body?.reason)) {
      return {
        controlPlane: {
          status: result.status,
        },
        intent: null,
        leased: false,
        plan,
        reason: result.body?.reason ?? "no_intent",
        ...(workspaceLease.lease ? { remoteWorkspaceLease: workspaceLease.lease } : {}),
      }
    }

    if (!remoteWorkspaceRelease.released) {
      return {
        controlPlane: {
          status: result.status,
        },
        intent: null,
        leased: false,
        plan,
        reason: "remote_workspace_release_failed",
        remoteWorkspaceLease: workspaceLease.lease,
        remoteWorkspaceRelease,
      }
    }

    attemptedWorkspaceReferences.add(workspaceReference)
  }
}

async function maybeAcquireRemoteWorkspaceSlot({
  config,
  coordinatorService,
  excludedWorkspaceReferences,
  request,
}: {
  config: RunnerConfig
  coordinatorService?: CoordinatorService
  excludedWorkspaceReferences?: ReadonlySet<string>
  request: SupervisorTickRequest
}): Promise<
  | { blocked: false; lease?: RemoteWorkspaceSlotLease }
  | {
      blocked: true
      reason: "remote_workspace_pool_full" | "remote_workspace_pool_not_configured"
      remoteWorkspacePool: { configured: boolean; slots: number }
    }
> {
  const holder = request.holder ?? config.holder
  if (!holder) return { blocked: false }

  const ttlSeconds = request.ttlSeconds ?? config.leaseTtlSeconds ?? 900
  const acquired = await acquireRemoteWorkspaceSlot({
    coordinator: coordinatorService,
    excludedWorkspaceReferences,
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

function isRemoteWorkspaceAlreadyAssignedReason(reason: unknown) {
  return typeof reason === "string" && /^remote workspace .+ is already assigned$/.test(reason)
}
