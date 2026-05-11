import { spawnSync } from "node:child_process"

export const dispatchableActions = new Set([
  "collect-ci",
  "cleanup",
  "open-pr",
  "publish-evidence",
  "start",
  "sync-pr",
])

export function selectDispatchRecommendation(recommendations, { action, issueNumber } = {}) {
  const normalizedIssueNumber = normalizeIssueNumber(issueNumber)
  const matches = recommendations.filter((recommendation) => {
    if (action && recommendation.action !== action) return false
    if (
      normalizedIssueNumber !== undefined &&
      recommendation.issue?.number !== normalizedIssueNumber
    ) {
      return false
    }
    return dispatchableActions.has(recommendation.action)
  })

  if (matches.length === 0) {
    return {
      recommendation: null,
      reason: "no dispatchable recommendation matched",
    }
  }

  return {
    recommendation: matches[0],
    reason:
      matches.length > 1 ? "selected highest-priority dispatchable recommendation" : "matched",
  }
}

export function dispatchCommandArgs(recommendation, { eventLog, repository }) {
  if (!dispatchableActions.has(recommendation.action)) {
    throw new Error(`action ${recommendation.action} is not dispatchable`)
  }

  const commandArgs = [
    `agent:queue:${recommendation.action}`,
    "--",
    "--issue",
    String(recommendation.issue.number),
    "--repo",
    repository,
    "--yes",
  ]

  if (eventLog) {
    commandArgs.push("--event-log", eventLog)
  }

  return commandArgs
}

export function runDispatchCommand(commandArgs) {
  return spawnSync("pnpm", commandArgs, {
    encoding: "utf8",
    stdio: "inherit",
  }).status
}

function normalizeIssueNumber(issueNumber) {
  if (issueNumber === undefined) return undefined

  const normalized = Number(issueNumber)
  if (!Number.isInteger(normalized) || normalized < 1) {
    throw new Error(`invalid issue number: ${String(issueNumber)}`)
  }

  return normalized
}
