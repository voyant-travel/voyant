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
  formatAgentRunnerEventSummary,
  readAgentRunnerEvents,
  resolveEventLogPath,
} from "./lib/agent-runner-events.mjs"
import {
  eventLogOptions,
  maybePrintHelp,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import { recommendQueueActions } from "./lib/agent-runner-tick.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:tick",
  summary:
    "Read the Project queue and recommend the next runner actions without mutating anything.",
  usage: "pnpm agent:queue:tick -- [--json] [--repo <owner/name>]",
  options: [
    ["--json", "Print machine-readable JSON."],
    ["--max-age-days <number>", "Heartbeat staleness threshold. Defaults to 1."],
    ["--recent-events <number>", "Number of recent runner events to show. Defaults to 5."],
    ...eventLogOptions,
    ...repositoryOptions,
    ...projectOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const maxAgeDays = Number(args.maxAgeDays ?? 1)
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
const recentEventLimit = numberArg(args.recentEvents, "recent-events", 5, { min: 0 })

if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0) {
  fail(`invalid max age days: ${String(args.maxAgeDays)}`)
}

const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const items = filterItemsByRepository(project.items, repository)
const recommendations = recommendQueueActions(items, { maxAgeDays, repository })
const recentEvents = readRecentEvents()

if (args.json) {
  console.log(
    JSON.stringify(
      {
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
          recentEvents,
        },
        recommendations,
      },
      null,
      2,
    ),
  )
} else {
  printHumanSummary()
}

function printHumanSummary() {
  console.log(
    `agent-runner tick: ${project.projectTitle} (${project.owner}/projects/${project.projectNumber})`,
  )
  console.log(`repository: ${repository}`)
  console.log(`items scanned: ${items.length}`)
  console.log(`recommendations: ${recommendations.length}`)
  console.log("")
  printRecentEvents()

  if (recommendations.length === 0) {
    console.log("No runner action recommended.")
    return
  }

  for (const recommendation of recommendations) {
    console.log(`- #${recommendation.issue.number} ${recommendation.issue.title}`)
    console.log(`  action: ${recommendation.action}`)
    console.log(`  state: ${recommendation.state ?? "unset"}`)
    console.log(`  reason: ${recommendation.reason}`)
    if (recommendation.command) {
      console.log(`  command: ${recommendation.command}`)
    }
    if (recommendation.heartbeat) {
      console.log(`  heartbeat: ${recommendation.heartbeat.reason}`)
    }
  }
}

function printRecentEvents() {
  if (recentEventLimit === 0 || recentEvents.length === 0) return

  console.log("Recent runner events:")
  for (const event of recentEvents) {
    console.log(`- ${formatAgentRunnerEventSummary(event)}`)
    if (event.recommendation?.reason) {
      console.log(`  reason: ${event.recommendation.reason}`)
    }
    if (Array.isArray(event.command) && event.command.length > 0) {
      console.log(`  command: ${event.command.join(" ")}`)
    } else if (typeof event.command === "string") {
      console.log(`  command: ${event.command}`)
    }
  }
  console.log("")
}

function readRecentEvents() {
  try {
    return readAgentRunnerEvents(eventLogPath, { limit: recentEventLimit })
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
