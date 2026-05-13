import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  buildDeployedStatusReport,
  latestControlPlaneTickSnapshot,
  latestRunnerSupervisorTick,
  recentControlPlaneTickSnapshots,
  recentRunnerSupervisorTicks,
  summarizeActiveDispatchIntent,
  summarizeDispatchPlan,
} from "./lib/agent-runner-deployed-status.mjs"
import { dispatchableActions } from "./lib/agent-runner-dispatch.mjs"
import { maybePrintHelp, repositoryOptions } from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:deployed-status",
  summary: "Inspect deployed control-plane and runner supervisor status.",
  usage: "pnpm agent:queue:deployed-status -- [--json] [--repo <owner/name>]",
  options: [
    ["--control-plane-url <url>", "Control-plane base URL. Defaults to AGENT_CONTROL_PLANE_URL."],
    ["AGENT_CONTROL_PLANE_TOKEN", "Bearer token environment variable used for control-plane APIs."],
    ["--runner-url <url>", "Runner app base URL. Defaults to AGENT_RUNNER_URL."],
    ["--runner-token <token>", "Runner app bearer token. Defaults to AGENT_RUNNER_TOKEN."],
    [
      "--limit <n>",
      "Number of recent queue snapshots and supervisor ticks to include. Defaults to 5 and is clamped by deployed apps.",
    ],
    ["--issue <number>", "Optional issue number for an active dispatch pointer lookup."],
    [
      "--action <name>",
      `Optional lifecycle action for an active dispatch pointer lookup. Allowed: ${Array.from(dispatchableActions).join(", ")}.`,
    ],
    ["--json", "Print machine-readable JSON."],
    ...repositoryOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const limit = positiveIntegerArg(args.limit, "limit", 5)
const activeDispatchRequest = optionalActiveDispatchRequest(args, repository)

try {
  const report = await buildDeployedStatusReport({
    activeDispatchRequest,
    args,
    limit,
    repository,
  })

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printHumanSummary(report)
  }

  process.exitCode = report.ok ? 0 : 1
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

function printHumanSummary(report) {
  console.log(`agent-runner deployed status: ${report.ok ? "OK" : "DEGRADED"}`)
  console.log(`repository: ${report.repository}`)
  console.log(`recent tick limit: ${report.limit}`)
  console.log("")

  for (const check of report.checks) {
    console.log(`${check.ok ? "OK" : "FAIL"} ${check.name}`)
    console.log(`  ${check.detail}`)
  }

  printControlPlaneSnapshotDetails(report.controlPlane?.recentTickSnapshots)
  printDispatchPlanDetails(report.controlPlane?.dispatchPlan)
  printActiveDispatchDetails(report.controlPlane?.activeDispatch)
  printRunnerPolicyDetails(report.runner?.policy)
  printRunnerSupervisorDetails(report.runner?.supervisorStatus)
}

function printControlPlaneSnapshotDetails(snapshotHistory) {
  if (!snapshotHistory) return

  const latest = latestControlPlaneTickSnapshot(snapshotHistory)
  const recent = recentControlPlaneTickSnapshots(snapshotHistory)

  console.log("")
  console.log("Control-plane queue snapshots:")
  if (latest) {
    console.log(`  latest accepted: ${latest.acceptedAt ?? "unknown"}`)
    console.log(`  latest recommendations: ${String(latest.recommendationCount ?? "unknown")}`)
    console.log(
      `  latest dispatchable: ${String(latest.dispatchableRecommendationCount ?? "unknown")}`,
    )
    if (latest.firstDispatchableIssueNumber) {
      console.log(
        `  first dispatchable: #${latest.firstDispatchableIssueNumber} ${latest.firstDispatchableAction ?? "unknown"}`,
      )
    }
  } else {
    console.log("  latest: none")
  }

  if (recent.length === 0) return

  console.log("  recent:")
  for (const snapshot of recent) {
    console.log(
      `  - ${snapshot.acceptedAt ?? "unknown"} recommendations=${String(snapshot.recommendationCount ?? "unknown")} dispatchable=${String(snapshot.dispatchableRecommendationCount ?? "unknown")}`,
    )
  }
}

function printDispatchPlanDetails(dispatchPlan) {
  if (!dispatchPlan) return

  const summary = summarizeDispatchPlan(dispatchPlan)

  console.log("")
  console.log("Control-plane dispatch plan:")
  if (!summary.found) {
    console.log(`  plan: none (${summary.reason ?? "unknown"})`)
    return
  }

  const issueTitle = summary.issueTitle ? ` ${summary.issueTitle}` : ""
  console.log(`  issue: #${summary.issueNumber ?? "unknown"}${issueTitle}`)
  console.log(`  action: ${summary.action ?? "unknown"}`)
  console.log(`  reason: ${summary.reason ?? "unknown"}`)
  console.log(`  command: ${summary.command ?? "unknown"}`)
  if (summary.snapshotAcceptedAt) {
    console.log(`  snapshot accepted: ${summary.snapshotAcceptedAt}`)
  }
}

function printActiveDispatchDetails(activeDispatch) {
  if (!activeDispatch) return

  const summary = summarizeActiveDispatchIntent(activeDispatch)

  console.log("")
  console.log("Control-plane active dispatch:")
  if (!summary.found) {
    console.log("  intent: none")
    return
  }

  console.log(`  intent: ${summary.intentId ?? "unknown"}`)
  console.log(`  issue: #${summary.issueNumber ?? "unknown"}`)
  console.log(`  action: ${summary.action ?? "unknown"}`)
  console.log(`  status: ${summary.status ?? "unknown"}`)
  console.log(`  active: ${String(summary.active)}`)
  console.log(`  holder: ${summary.holder ?? "unknown"}`)
  console.log(`  lease expires: ${summary.expiresAt ?? "unknown"}`)
}

function printRunnerSupervisorDetails(status) {
  if (!status) return

  const storage = status.supervisorTicks?.storage
  const latest = latestRunnerSupervisorTick(status)
  const recent = recentRunnerSupervisorTicks(status)

  console.log("")
  console.log("Runner supervisor:")
  console.log(`  storage configured: ${String(storage?.configured ?? "unknown")}`)
  console.log(`  persistence: ${storage?.persistence ?? "unknown"}`)
  if (latest) {
    console.log(`  latest: ${latest.recordedAt ?? "unknown"} ${latest.reason ?? "unknown"}`)
    console.log(`  latest leased: ${String(latest.leased ?? "unknown")}`)
    if (latest.intentId) {
      console.log(`  latest intent: ${latest.intentId}`)
    }
  } else {
    console.log("  latest: none")
  }

  if (recent.length === 0) return

  console.log("  recent:")
  for (const tick of recent) {
    const intent = tick.intentId ? ` intent=${tick.intentId}` : ""
    console.log(
      `  - ${tick.recordedAt ?? "unknown"} ${tick.reason ?? "unknown"} leased=${String(tick.leased ?? "unknown")}${intent}`,
    )
  }
}

function printRunnerPolicyDetails(policy) {
  if (!policy) return

  console.log("")
  console.log("Runner policy:")
  console.log(`  allowed actions: ${String(policy.allowedActionCount ?? "unknown")}`)
  console.log(`  default action: ${policy.defaultAction ?? "none"}`)
  console.log(`  daily lease budget: ${policy.maxDailyLeases ?? "none"}`)
  console.log(`  requires action filter: ${String(policy.requiresActionFilter ?? "unknown")}`)
  console.log(
    `  CI repair opt-in: ${policy.ciRepairEnabled ? policy.ciRepairAllowedActions.join(", ") : "off"}`,
  )
}

function positiveIntegerArg(value, name, fallback) {
  if (value === undefined) return fallback

  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}

function optionalActiveDispatchRequest(args, repository) {
  const issueProvided = args.issue !== undefined
  const actionProvided = args.action !== undefined
  if (!issueProvided && !actionProvided) return undefined
  if (!issueProvided || !actionProvided) {
    fail("active dispatch lookup requires both --issue and --action")
  }

  const issueNumber = positiveIntegerArg(args.issue, "issue")
  const action = String(args.action).trim()
  if (!dispatchableActions.has(action)) {
    fail(`action ${action} is not dispatchable`)
  }

  return {
    action,
    issueNumber,
    repository,
  }
}
