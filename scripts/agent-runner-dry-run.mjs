import {
  loadEvaluatedProject,
  parseArgs,
  projectConfigFromArgs,
} from "./lib/agent-project-queue.mjs"
import { printHumanSummary, projectSummaryJson } from "./lib/agent-runner-output.mjs"

const args = parseArgs(process.argv.slice(2))
const project = loadEvaluatedProject(projectConfigFromArgs(args))

if (args.json) {
  console.log(JSON.stringify(projectSummaryJson(project), null, 2))
} else {
  printHumanSummary(project)
}
