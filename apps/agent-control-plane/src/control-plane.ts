import { z } from "zod"
import {
  dispatchCommand,
  effectiveDispatchAction,
  remoteWorkspaceAlreadyAssigned,
  repositoriesMatch,
} from "./dispatch-planning.js"

export const dispatchableActions = [
  "collect-ci",
  "complete-pr",
  "cleanup",
  "open-pr",
  "publish-evidence",
  "remote-bootstrap",
  "remote-cleanup",
  "remote-open-pr",
  "remote-publish-evidence",
  "remote-repair-ci",
  "remote-run-command",
  "repair-ci",
  "run-command",
  "start",
  "sync-pr",
] as const

const dispatchableActionSet = new Set<string>(dispatchableActions)

const issueSchema = z
  .object({
    number: z.number().int().positive(),
    title: z.string().min(1),
    url: z.string().url(),
    repository: z.string().min(1),
  })
  .passthrough()

const queueRecommendationSchema = z
  .object({
    action: z.string(),
    command: z.string().nullable().optional(),
    heartbeat: z.record(z.string(), z.unknown()).nullable().optional(),
    issue: issueSchema,
    priority: z.number().finite().optional(),
    reason: z.string().min(1),
    state: z.string().nullable().optional(),
    workspace: z.string().nullable().optional(),
  })
  .passthrough()

const runnerEventSchema = z
  .object({
    timestamp: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
  })
  .passthrough()

const dispatchPlanFiltersSchema = z
  .object({
    action: z.string().optional(),
    issueNumber: z.number().int().positive().optional(),
  })
  .optional()

const dispatchPlanOptionsSchema = z
  .object({
    ciRepairCommand: z.string().min(1).optional(),
    eventLog: z.string().min(1).optional(),
    implementationCommand: z.string().trim().min(1).optional(),
    remoteImplementationCommand: z.string().trim().min(1).optional(),
    remoteWorkspace: z.string().trim().min(1).optional(),
    updateBody: z.boolean().optional(),
  })
  .optional()

export const dispatchPlanRequestSchema = z.object({
  filters: dispatchPlanFiltersSchema,
  options: dispatchPlanOptionsSchema,
  recommendations: z.array(queueRecommendationSchema).min(1),
  repository: z.string().min(1),
})

export type DispatchPlanRequest = z.infer<typeof dispatchPlanRequestSchema>

export const latestDispatchPlanRequestSchema = z.object({
  filters: dispatchPlanFiltersSchema,
  options: dispatchPlanOptionsSchema,
  repository: z.string().min(1),
})

export type LatestDispatchPlanRequest = z.infer<typeof latestDispatchPlanRequestSchema>

const dispatchIntentLeaseRequestSchema = z.object({
  holder: z.string().min(1),
  ttlSeconds: z.number().int().min(60).max(3600).optional(),
})

const dispatchIntentTerminalStatusSchema = z.enum(["completed", "failed", "released"])

export const dispatchIntentFinishRequestSchema = z.object({
  exitCode: z.number().int().optional(),
  holder: z.string().min(1),
  reason: z.string().min(1).optional(),
  status: dispatchIntentTerminalStatusSchema,
})

export type DispatchIntentFinishRequest = z.infer<typeof dispatchIntentFinishRequestSchema>

export const latestDispatchIntentRequestSchema = z.object({
  filters: dispatchPlanFiltersSchema,
  lease: dispatchIntentLeaseRequestSchema,
  options: dispatchPlanOptionsSchema,
  repository: z.string().min(1),
})

export type LatestDispatchIntentRequest = z.infer<typeof latestDispatchIntentRequestSchema>

export const activeDispatchIntentRequestSchema = z.object({
  action: z.enum(dispatchableActions),
  issueNumber: z.coerce.number().int().positive(),
  repository: z.string().trim().min(1),
})

export type ActiveDispatchIntentRequest = z.infer<typeof activeDispatchIntentRequestSchema>

export const tickSnapshotRequestSchema = z.object({
  eventLog: z.object({
    path: z.string().min(1),
    recentEvents: z.array(runnerEventSchema),
  }),
  maxAgeDays: z.number().int().nonnegative(),
  project: z.object({
    number: z.number().int().positive(),
    owner: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url(),
  }),
  recommendations: z.array(queueRecommendationSchema),
  repository: z.string().min(1),
})

export type TickSnapshotRequest = z.infer<typeof tickSnapshotRequestSchema>

const tickSnapshotSummarySchema = z.object({
  dispatchableRecommendationCount: z.number().int().nonnegative(),
  firstDispatchableAction: z.string().nullable(),
  firstDispatchableIssueNumber: z.number().int().positive().nullable(),
  recentEventCount: z.number().int().nonnegative(),
  recommendationCount: z.number().int().nonnegative(),
})

export const tickSnapshotRecordSchema = z.object({
  acceptedAt: z.string().min(1),
  snapshot: tickSnapshotRequestSchema,
  summary: tickSnapshotSummarySchema,
})

export type TickSnapshotRecord = z.infer<typeof tickSnapshotRecordSchema>

const dispatchPlanIssueSchema = issueSchema

const dispatchPlanSchema = z.object({
  action: z.enum(dispatchableActions),
  command: z.array(z.string()),
  issue: dispatchPlanIssueSchema,
  reason: z.string().min(1),
  repository: z.string().min(1),
  requiresMutation: z.literal(true),
})

const dispatchIntentSourceSchema = z.object({
  acceptedAt: z.string().min(1),
  recommendationCount: z.number().int().nonnegative(),
  repository: z.string().min(1),
  type: z.literal("latest_tick_snapshot"),
})

export const dispatchIntentRecordSchema = z.object({
  createdAt: z.string().min(1),
  id: z.string().min(1),
  lease: z.object({
    acquiredAt: z.string().min(1),
    expiresAt: z.string().min(1),
    holder: z.string().min(1),
    ttlSeconds: z.number().int().min(60).max(3600),
  }),
  plan: dispatchPlanSchema,
  resolution: z
    .object({
      finishedAt: z.string().min(1),
      holder: z.string().min(1),
      exitCode: z.number().int().optional(),
      reason: z.string().min(1).optional(),
    })
    .optional(),
  source: dispatchIntentSourceSchema,
  status: z.union([z.literal("leased"), dispatchIntentTerminalStatusSchema]),
})

export type DispatchIntentRecord = z.infer<typeof dispatchIntentRecordSchema>

export interface DispatchPlan {
  action: (typeof dispatchableActions)[number]
  command: string[]
  issue: DispatchPlanRequest["recommendations"][number]["issue"]
  reason: string
  repository: string
  requiresMutation: true
}

export interface DispatchPlanResult {
  plan: DispatchPlan | null
  reason: string
}

export interface StoredDispatchPlanResult extends DispatchPlanResult {
  source: {
    acceptedAt: string
    recommendationCount: number
    repository: string
    type: "latest_tick_snapshot"
  }
}

export interface DispatchIntentResult {
  intent: DispatchIntentRecord | null
  reason: string
  source: StoredDispatchPlanResult["source"]
}

export function buildCapabilities({
  dispatchIntentPersistence = "none",
  tickSnapshotPersistence = "none",
}: {
  dispatchIntentPersistence?: "leased" | "none"
  tickSnapshotPersistence?: "latest" | "none"
} = {}) {
  return {
    service: "agent-control-plane",
    version: 1,
    dispatchableActions,
    dryRunOnly: true,
    limits: {
      loopIterations: {
        min: 1,
        max: 100,
      },
      loopSleepSeconds: {
        min: 0,
        max: 3600,
      },
    },
    snapshotContracts: {
      tick: {
        history: tickSnapshotPersistence === "latest",
        version: 1,
        persistence: tickSnapshotPersistence,
      },
    },
    dispatchPlanSources: {
      inlineRecommendations: true,
      latestTickSnapshot: tickSnapshotPersistence === "latest",
    },
    dispatchIntentContracts: {
      latestSnapshotLease: {
        activeRead: dispatchIntentPersistence === "leased",
        persistence: dispatchIntentPersistence,
        terminalStatuses: dispatchIntentTerminalStatusSchema.options,
        ttlSeconds: {
          default: 900,
          min: 60,
          max: 3600,
        },
      },
    },
  }
}

export function acceptTickSnapshot(snapshot: TickSnapshotRequest) {
  const record = buildTickSnapshotRecord(snapshot)

  return {
    accepted: true,
    snapshot: record.snapshot,
    summary: record.summary,
  }
}

export function buildTickSnapshotRecord(
  snapshot: TickSnapshotRequest,
  { acceptedAt = new Date().toISOString() }: { acceptedAt?: string } = {},
): TickSnapshotRecord {
  const dispatchableRecommendations = snapshot.recommendations.filter((recommendation) =>
    isDispatchableAction(recommendation.action),
  )
  const firstDispatchable = dispatchableRecommendations[0] ?? null

  return {
    acceptedAt,
    snapshot,
    summary: {
      dispatchableRecommendationCount: dispatchableRecommendations.length,
      firstDispatchableAction: firstDispatchable?.action ?? null,
      firstDispatchableIssueNumber: firstDispatchable?.issue.number ?? null,
      recentEventCount: snapshot.eventLog.recentEvents.length,
      recommendationCount: snapshot.recommendations.length,
    },
  }
}

export function selectDispatchPlan(request: DispatchPlanRequest): DispatchPlanResult {
  const actionFilter = request.filters?.action
  if (actionFilter && !dispatchableActionSet.has(actionFilter)) {
    return { plan: null, reason: `action ${actionFilter} is not dispatchable` }
  }

  if (
    request.options?.remoteWorkspace &&
    remoteWorkspaceAlreadyAssigned({
      recommendations: request.recommendations,
      workspace: request.options.remoteWorkspace,
    })
  ) {
    return {
      plan: null,
      reason: `remote workspace ${request.options.remoteWorkspace} is already assigned`,
    }
  }

  let blockedReason: string | null = null

  for (const recommendation of request.recommendations) {
    if (!isDispatchableAction(recommendation.action)) continue
    if (actionFilter && recommendation.action !== actionFilter) continue
    if (
      request.filters?.issueNumber &&
      recommendation.issue.number !== request.filters.issueNumber
    ) {
      continue
    }
    if (!repositoriesMatch(recommendation.issue.repository, request.repository)) continue

    const action = effectiveDispatchAction({
      recommendationAction: recommendation.action,
      remoteWorkspace: request.options?.remoteWorkspace,
    })

    const commandResult = dispatchCommand({
      action,
      ciRepairCommand: request.options?.ciRepairCommand,
      eventLog: request.options?.eventLog,
      implementationCommand: request.options?.implementationCommand,
      issueNumber: recommendation.issue.number,
      remoteImplementationCommand: request.options?.remoteImplementationCommand,
      remoteWorkspace: request.options?.remoteWorkspace,
      repository: request.repository,
      updateBody: request.options?.updateBody,
    })
    if (!commandResult.ok) {
      blockedReason ??= commandResult.reason
      if (actionFilter) break
      continue
    }

    return {
      plan: {
        action,
        command: commandResult.command,
        issue: recommendation.issue,
        reason: recommendation.reason,
        repository: request.repository,
        requiresMutation: true,
      },
      reason: "matched",
    }
  }

  return {
    plan: null,
    reason: blockedReason ?? "no dispatchable recommendation matched",
  }
}

export function selectDispatchPlanFromTickSnapshotRecord({
  record,
  request,
}: {
  record: TickSnapshotRecord
  request: LatestDispatchPlanRequest
}): StoredDispatchPlanResult {
  const result = selectDispatchPlan({
    filters: request.filters,
    options: request.options,
    recommendations: record.snapshot.recommendations,
    repository: request.repository,
  })

  return {
    ...result,
    source: {
      acceptedAt: record.acceptedAt,
      recommendationCount: record.summary.recommendationCount,
      repository: record.snapshot.repository,
      type: "latest_tick_snapshot",
    },
  }
}

export function buildDispatchIntentFromStoredPlan({
  id,
  now = new Date(),
  request,
  result,
}: {
  id: string
  now?: Date
  request: LatestDispatchIntentRequest
  result: StoredDispatchPlanResult
}): DispatchIntentResult {
  if (!result.plan) {
    return {
      intent: null,
      reason: result.reason,
      source: result.source,
    }
  }

  const createdAt = now.toISOString()
  const ttlSeconds = request.lease.ttlSeconds ?? 900
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString()

  return {
    intent: {
      createdAt,
      id,
      lease: {
        acquiredAt: createdAt,
        expiresAt,
        holder: request.lease.holder,
        ttlSeconds,
      },
      plan: result.plan,
      source: result.source,
      status: "leased",
    },
    reason: "leased",
    source: result.source,
  }
}

export function isDispatchIntentActive(intent: DispatchIntentRecord, now = new Date()) {
  return intent.status === "leased" && Date.parse(intent.lease.expiresAt) > now.getTime()
}

export function finishDispatchIntent({
  intent,
  now = new Date(),
  request,
}: {
  intent: DispatchIntentRecord
  now?: Date
  request: DispatchIntentFinishRequest
}): DispatchIntentRecord {
  return {
    ...intent,
    resolution: {
      finishedAt: now.toISOString(),
      holder: request.holder,
      ...(request.exitCode === undefined ? {} : { exitCode: request.exitCode }),
      ...(request.reason ? { reason: request.reason } : {}),
    },
    status: request.status,
  }
}

function isDispatchableAction(action: string): action is DispatchPlan["action"] {
  return dispatchableActionSet.has(action)
}
