import fs from "node:fs"

import {
  currentRepositoryFromOrigin,
  fail,
  filterItemsByRepository,
  loadAllEvaluatedProject,
  parseArgs,
  projectScanConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"
import {
  controlPlaneConfigFromArgs,
  submitTickSnapshot,
} from "./lib/agent-runner-control-plane.mjs"
import { readAgentRunnerEvents, resolveEventLogPath } from "./lib/agent-runner-events.mjs"
import {
  eventLogOptions,
  maybePrintHelp,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import { recommendQueueActions } from "./lib/agent-runner-tick.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:submit-tick",
  summary: "Submit a queue tick snapshot to the agent control plane without dispatching work.",
  usage: "pnpm agent:queue:submit-tick -- [--input <path|->] [--control-plane-url <url>]",
  options: [
    ["--input <path|->", "Submit an existing tick JSON file, or read JSON from stdin with '-'."],
    ["--control-plane-url <url>", "Control-plane base URL. Defaults to AGENT_CONTROL_PLANE_URL."],
    ["AGENT_CONTROL_PLANE_TOKEN", "Bearer token environment variable used for API routes."],
    [
      "--max-age-days <number>",
      "Heartbeat staleness threshold when generating a snapshot. Defaults to 1.",
    ],
    ["--recent-events <number>", "Number of recent runner events to include. Defaults to 5."],
    ...eventLogOptions,
    ...repositoryOptions,
    ...projectOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const snapshot = args.input ? readSnapshotInput(args.input) : generateSnapshot()
const config = readControlPlaneConfig()

try {
  const result = await submitTickSnapshot({
    snapshot,
    token: config.token,
    url: config.url,
  })

  console.log("agent-runner submitted tick snapshot")
  console.log(`control plane: ${config.url}`)
  console.log(`repository: ${result.snapshot?.repository ?? snapshot.repository}`)
  console.log(`recommendations: ${result.summary?.recommendationCount ?? "unknown"}`)
  console.log(`dispatchable: ${result.summary?.dispatchableRecommendationCount ?? "unknown"}`)
  if (result.summary?.firstDispatchableIssueNumber) {
    console.log(
      `first dispatchable: #${result.summary.firstDispatchableIssueNumber} ${result.summary.firstDispatchableAction}`,
    )
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

function generateSnapshot() {
  const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
  const maxAgeDays = Number(args.maxAgeDays ?? 1)
  const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
  const recentEventLimit = numberArg(args.recentEvents, "recent-events", 5, { min: 0 })

  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0) {
    fail(`invalid max age days: ${String(args.maxAgeDays)}`)
  }

  const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
  const items = filterItemsByRepository(project.items, repository)

  return {
    project: {
      owner: project.owner,
      number: project.projectNumber,
      title: project.projectTitle,
      url: project.projectUrl,
    },
    repository,
    maxAgeDays,
    eventLog: {
      path: eventLogPath,
      recentEvents: readRecentEvents(eventLogPath, recentEventLimit),
    },
    recommendations: recommendQueueActions(items, { maxAgeDays, repository }),
  }
}

function readSnapshotInput(input) {
  const text = input === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(input, "utf8")
  try {
    return JSON.parse(text)
  } catch (error) {
    fail(`invalid tick snapshot JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function readControlPlaneConfig() {
  try {
    return controlPlaneConfigFromArgs(args)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

function readRecentEvents(eventLogPath, limit) {
  try {
    return readAgentRunnerEvents(eventLogPath, { limit })
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

function numberArg(value, name, fallback, { min = 1 } = {}) {
  if (value === undefined) return fallback

  const number = Number(value)
  if (!Number.isInteger(number) || number < min) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}
