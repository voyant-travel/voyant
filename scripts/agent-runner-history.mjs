import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  controlPlaneConfigFromArgs,
  requestRecentTickSnapshots,
} from "./lib/agent-runner-control-plane.mjs"
import {
  requestRecentRunnerSupervisorTicks,
  runnerAppConfigFromArgs,
} from "./lib/agent-runner-deployment-doctor.mjs"
import { maybePrintHelp, repositoryOptions } from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:history",
  summary: "Inspect recent persisted queue snapshots or runner supervisor ticks.",
  usage: "pnpm agent:queue:history -- [--source control-plane|runner] [--repo <owner/name>]",
  options: [
    ["--source <name>", "History source to read. Defaults to control-plane."],
    [
      "--limit <n>",
      "Number of records to read. Defaults to 20 and is clamped by the deployed app.",
    ],
    ["--control-plane-url <url>", "Control-plane base URL. Defaults to AGENT_CONTROL_PLANE_URL."],
    ["AGENT_CONTROL_PLANE_TOKEN", "Bearer token environment variable used for control-plane APIs."],
    ["--runner-url <url>", "Runner app base URL. Defaults to AGENT_RUNNER_URL."],
    ["--runner-token <token>", "Runner app bearer token. Defaults to AGENT_RUNNER_TOKEN."],
    ["--json", "Print machine-readable JSON."],
    ...repositoryOptions,
  ],
})

const source = args.source ?? "control-plane"
if (!["control-plane", "runner"].includes(source)) {
  fail(`invalid source: ${source}`)
}

const repository =
  args.repo ?? currentRepositoryFromOrigin(runGit(["rev-parse", "--show-toplevel"]))
const limit = optionalPositiveInteger(args.limit, "limit")

try {
  const result = source === "runner" ? await readRunnerHistory() : await readControlPlaneHistory()

  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printHistory(result)
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

async function readControlPlaneHistory() {
  const config = controlPlaneConfigFromArgs(args)
  const response = await requestRecentTickSnapshots({
    limit,
    repository,
    token: config.token,
    url: config.url,
  })

  return {
    endpoint: config.url,
    records: response.records ?? [],
    repository: response.repository ?? repository,
    source,
  }
}

async function readRunnerHistory() {
  const config = runnerAppConfigFromArgs(args)
  const response = await requestRecentRunnerSupervisorTicks({
    limit,
    repository,
    token: config.token,
    url: config.url,
  })

  return {
    endpoint: config.url,
    records: response.records ?? [],
    repository: response.repository ?? repository,
    source,
  }
}

function printHistory({ endpoint, records, repository, source }) {
  console.log(`agent-runner history: ${source}`)
  console.log(`endpoint: ${endpoint}`)
  console.log(`repository: ${repository}`)
  console.log(`records: ${records.length}`)

  for (const record of records) {
    console.log("")
    if (source === "runner") {
      printRunnerTick(record)
    } else {
      printTickSnapshot(record)
    }
  }
}

function printTickSnapshot(record) {
  console.log(`accepted: ${record.acceptedAt ?? "unknown"}`)
  console.log(`recommendations: ${record.summary?.recommendationCount ?? "unknown"}`)
  console.log(`dispatchable: ${record.summary?.dispatchableRecommendationCount ?? "unknown"}`)
  if (record.summary?.firstDispatchableIssueNumber) {
    console.log(
      `first dispatchable: #${record.summary.firstDispatchableIssueNumber} ${record.summary.firstDispatchableAction}`,
    )
  }
}

function printRunnerTick(record) {
  console.log(`recorded: ${record.recordedAt ?? "unknown"}`)
  console.log(`reason: ${record.result?.reason ?? "unknown"}`)
  console.log(`leased: ${String(record.result?.leased ?? "unknown")}`)
  const intent = record.result?.intent ?? record.result?.activeIntent
  if (intent?.id) {
    console.log(`intent: ${intent.id}`)
  }
}

function optionalPositiveInteger(value, name) {
  if (value === undefined) return undefined

  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}
