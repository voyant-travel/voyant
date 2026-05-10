import {
  currentRepositoryFromOrigin,
  fail,
  filterItemsByRepository,
  loadAllEvaluatedProject,
  parseArgs,
  projectScanConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"
import { maybePrintHelp, projectOptions, repositoryOptions } from "./lib/agent-runner-help.mjs"
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

const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const items = filterItemsByRepository(project.items, repository)
const recommendations = recommendQueueActions(items, { maxAgeDays, repository })

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
