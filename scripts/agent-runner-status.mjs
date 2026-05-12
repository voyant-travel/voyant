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
  browserEvidenceReferenceKind,
  requiresBrowserEvidence,
} from "./lib/agent-runner-browser-evidence.mjs"
import { readAgentRunnerEvents, resolveEventLogPath } from "./lib/agent-runner-events.mjs"
import { maybePrintHelp, projectOptions, repositoryOptions } from "./lib/agent-runner-help.mjs"
import { evaluateHeartbeat } from "./lib/agent-runner-output.mjs"

const activeStates = new Set([
  "Planning",
  "Running",
  "Blocked",
  "Human Review",
  "Changes Requested",
  "CI Repair",
])

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:status",
  summary: "Print a read-only overview of ready, active, stale, blocked, and review work.",
  usage: "pnpm agent:queue:status -- [--json] [--repo <owner/name>]",
  options: [
    ["--json", "Print machine-readable JSON."],
    ["--max-age-days <number>", "Heartbeat staleness threshold. Defaults to 1."],
    ["--event-log <path>", "JSONL audit log path. Defaults to .agent-runs/events.jsonl."],
    ["--recent-events <number>", "Number of recent runner events to show. Defaults to 5."],
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
const readyItems = items.filter((item) => item.ready)
const activeItems = items
  .filter((item) => activeStates.has(item.fields["Agent State"]))
  .map((item) => ({
    ...item,
    heartbeat: evaluateHeartbeat(item.fields["Last Heartbeat"], { maxAgeDays }),
  }))
const staleItems = activeItems.filter((item) => item.heartbeat.stale)
const blockedItems = items.filter((item) => item.fields["Agent State"] === "Blocked")
const reviewItems = items.filter((item) => item.fields["Agent State"] === "Human Review")
const mergeReadyItems = items.filter((item) => item.fields["Agent State"] === "Merge Ready")
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
        counts: {
          scanned: items.length,
          ready: readyItems.length,
          active: activeItems.length,
          stale: staleItems.length,
          blocked: blockedItems.length,
          humanReview: reviewItems.length,
          mergeReady: mergeReadyItems.length,
        },
        readyItems: readyItems.map(summaryItem),
        activeItems: activeItems.map(summaryItem),
        staleItems: staleItems.map(summaryItem),
        blockedItems: blockedItems.map(summaryItem),
        humanReviewItems: reviewItems.map(summaryItem),
        mergeReadyItems: mergeReadyItems.map(summaryItem),
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
    `agent-runner status: ${project.projectTitle} (${project.owner}/projects/${project.projectNumber})`,
  )
  console.log(`repository: ${repository}`)
  console.log(`items scanned: ${items.length}`)
  console.log(`ready items: ${readyItems.length}`)
  console.log(`active items: ${activeItems.length}`)
  console.log(`stale active items: ${staleItems.length}`)
  console.log(`blocked items: ${blockedItems.length}`)
  console.log(`human review items: ${reviewItems.length}`)
  console.log(`merge ready items: ${mergeReadyItems.length}`)
  console.log("")

  printSection("Ready items", readyItems)
  printSection("Stale active items", staleItems, printHeartbeat)
  printSection("Blocked items", blockedItems)
  printSection("Human review items", reviewItems)
  printSection("Merge ready items", mergeReadyItems)
  printRecentEvents()
}

function printSection(title, sectionItems, extraPrinter) {
  if (sectionItems.length === 0) return

  console.log(`${title}:`)
  for (const item of sectionItems) {
    console.log(`- #${item.issue.number} ${item.issue.title}`)
    console.log(`  state: ${item.fields["Agent State"] ?? "unset"}`)
    console.log(`  url: ${item.issue.url}`)
    printBrowserEvidenceStatus(item)
    if (extraPrinter) extraPrinter(item)
  }
  console.log("")
}

function printBrowserEvidenceStatus(item) {
  if (!requiresBrowserEvidence(item)) return

  const referenceKind = browserEvidenceReferenceKind(item.fields.Evidence)
  console.log(`  browser evidence: required; ${browserEvidenceStatusText(referenceKind)}`)
}

function browserEvidenceStatusText(referenceKind) {
  if (referenceKind === "browser-artifacts") return "browser artifact reference is present"
  if (referenceKind === "evidence-packet") return "inspect evidence packet for browser artifacts"
  if (referenceKind === "generic") return "Evidence field is not a browser artifact"
  return "Evidence field is empty"
}

function printHeartbeat(item) {
  console.log(`  heartbeat: ${item.fields["Last Heartbeat"] ?? "unset"}`)
  console.log(`  reason: ${item.heartbeat.reason}`)
}

function printRecentEvents() {
  if (recentEventLimit === 0 || recentEvents.length === 0) return

  console.log("Recent runner events:")
  for (const event of recentEvents) {
    console.log(`- ${formatEventSummary(event)}`)
    if (event.recommendation?.reason) {
      console.log(`  reason: ${event.recommendation.reason}`)
    }
    if (Array.isArray(event.command) && event.command.length > 0) {
      console.log(`  command: ${event.command.join(" ")}`)
    }
  }
  console.log("")
}

function formatEventSummary(event) {
  const issueNumber = event.recommendation?.issue?.number
  const action = event.recommendation?.action
  const status = event.status === undefined ? null : `status ${event.status}`
  return [
    event.timestamp ?? "no timestamp",
    event.type,
    issueNumber ? `#${issueNumber}` : null,
    action ?? null,
    status,
  ]
    .filter(Boolean)
    .join(" ")
}

function summaryItem(item) {
  const browserEvidenceRequired = requiresBrowserEvidence(item)
  const browserEvidenceKind = browserEvidenceReferenceKind(item.fields.Evidence)

  return {
    issue: item.issue,
    agentState: item.fields["Agent State"] ?? null,
    maintainerApproved: item.fields["Maintainer Approved"] ?? null,
    lastHeartbeat: item.fields["Last Heartbeat"] ?? null,
    heartbeat: item.heartbeat ?? null,
    branch: item.fields.Branch ?? null,
    workspace: item.fields.Workspace ?? null,
    pr: item.fields.PR ?? null,
    evidence: item.fields.Evidence ?? null,
    browserEvidence: {
      required: browserEvidenceRequired,
      referenceKind: browserEvidenceKind,
      browserArtifactReferencePresent: browserEvidenceKind === "browser-artifacts",
    },
  }
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
