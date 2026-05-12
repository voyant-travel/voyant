import { spawnSync } from "node:child_process"

export const dispatchableActions = new Set([
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

export function dispatchCommandArgs(recommendation, { eventLog, repository, updateBody } = {}) {
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

  if (updateBody && recommendation.action === "sync-pr") {
    commandArgs.push("--update-body")
  }

  return commandArgs
}

export function runDispatchCommand(commandArgs) {
  return spawnSync("pnpm", commandArgs, {
    encoding: "utf8",
    stdio: "inherit",
  }).status
}

export function dispatchIntentCommandArgs(intent) {
  const command = intent?.plan?.command
  if (!Array.isArray(command) || command.length < 2) {
    throw new Error("dispatch intent command is missing")
  }

  const [binary, script, ...rest] = command
  if (binary !== "pnpm") {
    throw new Error(`dispatch intent command must use pnpm, got ${String(binary)}`)
  }
  if (typeof script !== "string" || !script.startsWith("agent:queue:")) {
    throw new Error("dispatch intent command must target an agent queue script")
  }

  const action = script.slice("agent:queue:".length)
  if (action !== intent.plan.action) {
    throw new Error(`dispatch intent command action ${action} does not match ${intent.plan.action}`)
  }
  if (!dispatchableActions.has(action)) {
    throw new Error(`action ${action} is not dispatchable`)
  }
  if (rest[0] !== "--") {
    throw new Error("dispatch intent command must include the pnpm argument separator")
  }
  const issueNumber = optionValue(rest, "--issue")
  if (issueNumber !== String(intent.plan.issue.number)) {
    throw new Error("dispatch intent command issue does not match the leased plan")
  }
  const repository = optionValue(rest, "--repo")
  if (!repositoriesMatch(repository, intent.plan.repository)) {
    throw new Error("dispatch intent command repository does not match the leased plan")
  }
  if (!rest.includes("--yes")) {
    throw new Error("dispatch intent command must include --yes")
  }

  return [script, ...rest]
}

export function runDispatchIntentCommand(intent, { spawn = spawnSync } = {}) {
  return spawn("pnpm", dispatchIntentCommandArgs(intent), {
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

function optionValue(args, name) {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

function repositoriesMatch(left, right) {
  return (
    typeof left === "string" &&
    typeof right === "string" &&
    left.trim().toLowerCase() === right.trim().toLowerCase()
  )
}
