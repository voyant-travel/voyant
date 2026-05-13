import type { DispatchPlan, DispatchPlanRequest } from "./control-plane.js"

export function dispatchCommand({
  action,
  ciRepairCommand,
  eventLog,
  implementationCommand,
  issueNumber,
  remoteImplementationCommand,
  remoteWorkspace,
  repository,
  updateBody,
}: {
  action: DispatchPlan["action"]
  ciRepairCommand?: string
  eventLog?: string
  implementationCommand?: string
  issueNumber: number
  remoteImplementationCommand?: string
  remoteWorkspace?: string
  repository: string
  updateBody?: boolean
}) {
  const commandOption = implementationCommandForAction({
    action,
    implementationCommand,
    remoteImplementationCommand,
  })
  if (!commandOption.ok) return commandOption

  const command = [
    "pnpm",
    `agent:queue:${action}`,
    "--",
    "--issue",
    String(issueNumber),
    "--repo",
    repository,
  ]

  if (commandOption.command) command.push("--command", commandOption.command)
  if (remoteWorkspace && action === "remote-bootstrap") {
    command.push("--workspace", remoteWorkspace)
  }

  command.push("--yes")
  if (eventLog) command.push("--event-log", eventLog)
  if (ciRepairCommand && (action === "repair-ci" || action === "remote-repair-ci")) {
    command.push("--ci-repair-command", ciRepairCommand)
  }
  if (updateBody && action === "sync-pr") command.push("--update-body")

  return { ok: true as const, command }
}

export function effectiveDispatchAction({
  recommendationAction,
  remoteWorkspace,
}: {
  recommendationAction: string
  remoteWorkspace?: string
}): DispatchPlan["action"] {
  return recommendationAction === "start" && remoteWorkspace
    ? "remote-bootstrap"
    : (recommendationAction as DispatchPlan["action"])
}

export function remoteWorkspaceAlreadyAssigned({
  recommendations,
  workspace,
}: {
  recommendations: DispatchPlanRequest["recommendations"]
  workspace: string
}) {
  return recommendations.some(
    (recommendation) =>
      recommendation.workspace === workspace && recommendation.issue.state !== "CLOSED",
  )
}

export function repositoriesMatch(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

function implementationCommandForAction({
  action,
  implementationCommand,
  remoteImplementationCommand,
}: {
  action: DispatchPlan["action"]
  implementationCommand?: string
  remoteImplementationCommand?: string
}) {
  if (action === "run-command") {
    if (!implementationCommand) {
      return { ok: false as const, reason: "run-command requires implementation command" }
    }

    return { ok: true as const, command: implementationCommand }
  }

  if (action !== "remote-run-command") return { ok: true as const, command: null }

  const command = remoteImplementationCommand ?? implementationCommand
  if (!command) {
    return {
      ok: false as const,
      reason: "remote-run-command requires remote implementation command",
    }
  }

  return { ok: true as const, command }
}
