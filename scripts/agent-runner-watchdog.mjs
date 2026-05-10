import {
  currentRepositoryFromOrigin,
  fail,
  filterItemsByRepository,
  loadAllEvaluatedProject,
  parseArgs,
  projectConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"
import { evaluateHeartbeat } from "./lib/agent-runner-output.mjs"

const watchedStates = new Set([
  "Planning",
  "Running",
  "Blocked",
  "Human Review",
  "Changes Requested",
  "CI Repair",
])

const args = parseArgs(process.argv.slice(2))
const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const maxAgeDays = Number(args.maxAgeDays ?? 1)

if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0) {
  fail(`invalid max age days: ${String(args.maxAgeDays)}`)
}

const project = loadAllEvaluatedProject(
  projectConfigFromArgs({ ...args, limit: args.limit ?? 100 }),
)
const activeItems = filterItemsByRepository(project.items, repository).filter((item) =>
  watchedStates.has(item.fields["Agent State"]),
)
const staleItems = activeItems
  .map((item) => ({
    ...item,
    heartbeat: evaluateHeartbeat(item.fields["Last Heartbeat"], { maxAgeDays }),
  }))
  .filter((item) => item.heartbeat.stale)

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
        activeCount: activeItems.length,
        staleCount: staleItems.length,
        staleItems: staleItems.map(summaryItem),
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
    `agent-runner watchdog: ${project.projectTitle} (${project.owner}/projects/${project.projectNumber})`,
  )
  console.log(`repository: ${repository}`)
  console.log(`active items: ${activeItems.length}`)
  console.log(`stale items: ${staleItems.length}`)
  console.log(`max heartbeat age: ${maxAgeDays} day${maxAgeDays === 1 ? "" : "s"}`)
  console.log("")

  if (staleItems.length === 0) {
    console.log("No stale agent work found.")
    return
  }

  console.log("Stale items:")
  for (const item of staleItems) {
    console.log(`- #${item.issue.number} ${item.issue.title}`)
    console.log(`  state: ${item.fields["Agent State"]}`)
    console.log(`  heartbeat: ${item.fields["Last Heartbeat"] ?? "unset"}`)
    console.log(`  reason: ${item.heartbeat.reason}`)
    console.log(`  url: ${item.issue.url}`)
  }
}

function summaryItem(item) {
  return {
    issue: item.issue,
    agentState: item.fields["Agent State"],
    lastHeartbeat: item.fields["Last Heartbeat"] ?? null,
    reason: item.heartbeat.reason,
    branch: item.fields.Branch ?? null,
    workspace: item.fields.Workspace ?? null,
    evidence: item.fields.Evidence ?? null,
  }
}
