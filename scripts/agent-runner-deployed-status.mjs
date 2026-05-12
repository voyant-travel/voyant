import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  buildDeployedStatusReport,
  latestRunnerSupervisorTick,
  recentRunnerSupervisorTicks,
} from "./lib/agent-runner-deployed-status.mjs"
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
      "Number of recent supervisor ticks to include. Defaults to 5 and is clamped by the deployed app.",
    ],
    ["--json", "Print machine-readable JSON."],
    ...repositoryOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const limit = positiveIntegerArg(args.limit, "limit", 5)

try {
  const report = await buildDeployedStatusReport({
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

  printRunnerSupervisorDetails(report.runner?.supervisorStatus)
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

function positiveIntegerArg(value, name, fallback) {
  if (value === undefined) return fallback

  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}
