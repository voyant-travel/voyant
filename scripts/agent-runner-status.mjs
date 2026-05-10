import {
  currentRepositoryFromOrigin,
  fail,
  filterItemsByRepository,
  loadAllEvaluatedProject,
  parseArgs,
  projectConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"
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
    ...repositoryOptions,
    ...projectOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const maxAgeDays = Number(args.maxAgeDays ?? 1)

if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0) {
  fail(`invalid max age days: ${String(args.maxAgeDays)}`)
}

const project = loadAllEvaluatedProject(
  projectConfigFromArgs({ ...args, limit: args.limit ?? 100 }),
)
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
}

function printSection(title, sectionItems, extraPrinter) {
  if (sectionItems.length === 0) return

  console.log(`${title}:`)
  for (const item of sectionItems) {
    console.log(`- #${item.issue.number} ${item.issue.title}`)
    console.log(`  state: ${item.fields["Agent State"] ?? "unset"}`)
    console.log(`  url: ${item.issue.url}`)
    if (extraPrinter) extraPrinter(item)
  }
  console.log("")
}

function printHeartbeat(item) {
  console.log(`  heartbeat: ${item.fields["Last Heartbeat"] ?? "unset"}`)
  console.log(`  reason: ${item.heartbeat.reason}`)
}

function summaryItem(item) {
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
  }
}
