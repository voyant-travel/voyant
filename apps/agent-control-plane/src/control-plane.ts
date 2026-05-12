import { z } from "zod"

export const dispatchableActions = [
  "collect-ci",
  "cleanup",
  "open-pr",
  "publish-evidence",
  "remote-bootstrap",
  "remote-cleanup",
  "remote-open-pr",
  "remote-publish-evidence",
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
  })
  .passthrough()

const runnerEventSchema = z
  .object({
    timestamp: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
  })
  .passthrough()

export const dispatchPlanRequestSchema = z.object({
  filters: z
    .object({
      action: z.string().optional(),
      issueNumber: z.number().int().positive().optional(),
    })
    .optional(),
  options: z
    .object({
      eventLog: z.string().min(1).optional(),
      updateBody: z.boolean().optional(),
    })
    .optional(),
  recommendations: z.array(queueRecommendationSchema).min(1),
  repository: z.string().min(1),
})

export type DispatchPlanRequest = z.infer<typeof dispatchPlanRequestSchema>

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

export function buildCapabilities() {
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
        version: 1,
        persistence: "none",
      },
    },
  }
}

export function acceptTickSnapshot(snapshot: TickSnapshotRequest) {
  const dispatchableRecommendations = snapshot.recommendations.filter((recommendation) =>
    isDispatchableAction(recommendation.action),
  )
  const firstDispatchable = dispatchableRecommendations[0] ?? null

  return {
    accepted: true,
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
    return {
      plan: null,
      reason: `action ${actionFilter} is not dispatchable`,
    }
  }

  const recommendation = request.recommendations.find((candidate) => {
    if (!isDispatchableAction(candidate.action)) return false
    if (actionFilter && candidate.action !== actionFilter) return false
    if (request.filters?.issueNumber && candidate.issue.number !== request.filters.issueNumber) {
      return false
    }
    if (!repositoriesMatch(candidate.issue.repository, request.repository)) return false
    return true
  })

  if (!recommendation) {
    return {
      plan: null,
      reason: "no dispatchable recommendation matched",
    }
  }
  const action = recommendation.action
  if (!isDispatchableAction(action)) {
    return {
      plan: null,
      reason: `action ${action} is not dispatchable`,
    }
  }

  return {
    plan: {
      action,
      command: dispatchCommand({
        action,
        eventLog: request.options?.eventLog,
        issueNumber: recommendation.issue.number,
        repository: request.repository,
        updateBody: request.options?.updateBody,
      }),
      issue: recommendation.issue,
      reason: recommendation.reason,
      repository: request.repository,
      requiresMutation: true,
    },
    reason: "matched",
  }
}

function dispatchCommand({
  action,
  eventLog,
  issueNumber,
  repository,
  updateBody,
}: {
  action: DispatchPlan["action"]
  eventLog?: string
  issueNumber: number
  repository: string
  updateBody?: boolean
}) {
  const command = [
    "pnpm",
    `agent:queue:${action}`,
    "--",
    "--issue",
    String(issueNumber),
    "--repo",
    repository,
    "--yes",
  ]

  if (eventLog) {
    command.push("--event-log", eventLog)
  }

  if (updateBody && action === "sync-pr") {
    command.push("--update-body")
  }

  return command
}

function isDispatchableAction(action: string): action is DispatchPlan["action"] {
  return dispatchableActionSet.has(action)
}

function repositoriesMatch(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}
