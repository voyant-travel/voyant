import {
  loadAllEvaluatedProject,
  parseArgs,
  projectScanConfigFromArgs,
} from "./lib/agent-project-queue.mjs"
import { maybePrintHelp, projectOptions } from "./lib/agent-runner-help.mjs"
import { printHumanSummary, projectSummaryJson } from "./lib/agent-runner-output.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:dry-run",
  summary: "Read the agent Project queue and print executable work without mutating anything.",
  usage: "pnpm agent:queue:dry-run -- [--json]",
  options: [["--json", "Print machine-readable JSON."], ...projectOptions],
})

const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))

if (args.json) {
  console.log(JSON.stringify(projectSummaryJson(project), null, 2))
} else {
  printHumanSummary(project)
}
