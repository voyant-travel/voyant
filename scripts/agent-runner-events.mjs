import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  eventIssueDetails,
  filterAgentRunnerEvents,
  formatAgentRunnerEventSummary,
  readAgentRunnerEvents,
  resolveEventLogPath,
} from "./lib/agent-runner-events.mjs"
import { eventLogOptions, maybePrintHelp, repositoryOptions } from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:events",
  summary: "Print a filtered timeline from the local runner JSONL audit log.",
  usage: "pnpm agent:queue:events -- [--issue <number>] [--type <event>] [--json]",
  options: [
    ["--json", "Print machine-readable JSON."],
    ["--issue <number>", "Only show events for this issue number."],
    ["--type <event>", "Only show events with this exact event type."],
    ["--limit <number>", "Maximum events to print after filtering. Defaults to 20."],
    ["--scan-limit <number>", "Recent log entries to scan before filtering. Defaults to 500."],
    ...eventLogOptions,
    ...repositoryOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
const limit = numberArg(args.limit, "limit", 20)
const scanLimit = numberArg(args.scanLimit, "scan-limit", Math.max(500, limit))

let events
try {
  events = filterAgentRunnerEvents(readAgentRunnerEvents(eventLogPath, { limit: scanLimit }), {
    issueNumber: args.issue,
    repository,
    type: args.type,
  }).slice(-limit)
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

if (args.json) {
  console.log(
    JSON.stringify(
      {
        eventLog: {
          path: eventLogPath,
          scanLimit,
        },
        filters: {
          issue: args.issue ? Number(args.issue) : null,
          repository,
          type: args.type ?? null,
        },
        count: events.length,
        events,
      },
      null,
      2,
    ),
  )
} else {
  printHumanTimeline()
}

function printHumanTimeline() {
  console.log("agent-runner events")
  console.log(`repository: ${repository}`)
  console.log(`event log: ${eventLogPath}`)
  if (args.issue) console.log(`issue: #${args.issue}`)
  if (args.type) console.log(`type: ${args.type}`)
  console.log(`events: ${events.length}`)
  console.log("")

  if (events.length === 0) {
    console.log("No matching runner events.")
    return
  }

  for (const event of events) {
    console.log(`- ${formatAgentRunnerEventSummary(event)}`)
    printEventDetail(event)
  }
}

function printEventDetail(event) {
  const issue = eventIssueDetails(event)
  if (issue?.title) console.log(`  issue: ${issue.title}`)
  if (event.recommendation?.reason) console.log(`  reason: ${event.recommendation.reason}`)
  if (Array.isArray(event.command) && event.command.length > 0) {
    console.log(`  command: ${event.command.join(" ")}`)
  } else if (typeof event.command === "string") {
    console.log(`  command: ${event.command}`)
  }
  if (event.branch) console.log(`  branch: ${event.branch}`)
  if (event.workspace) console.log(`  workspace: ${event.workspace}`)
  if (event.remoteDir) console.log(`  remote dir: ${event.remoteDir}`)
  if (event.evidence) console.log(`  evidence: ${event.evidence}`)
  if (event.artifacts) console.log(`  artifacts: ${event.artifacts}`)
  if (event.exitCode !== undefined) console.log(`  exit code: ${event.exitCode}`)
  if (event.blockedBy) console.log(`  blocked by: ${event.blockedBy}`)
  if (event.pr?.url) console.log(`  pr: ${event.pr.url}`)
}

function numberArg(value, name, fallback) {
  if (value === undefined) return fallback

  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}
