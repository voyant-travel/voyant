import { updateProjectItemFields } from "./lib/agent-project-fields.mjs"
import {
  currentRepositoryFromOrigin,
  fail,
  findSelectedReadyItem,
  loadEvaluatedProject,
  parseArgs,
  projectConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"

const args = parseArgs(process.argv.slice(2))
const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const project = loadEvaluatedProject(projectConfigFromArgs(args))
const item = findSelectedReadyItem(project.items, {
  issueNumber: args.issue,
  repository,
})
const values = {
  Status: "In Progress",
  "Agent State": "Planning",
  Branch: item.dryRunPlan.branch,
  Workspace: item.dryRunPlan.workspace,
  "Last Heartbeat": today(),
}

if (!args.yes) {
  printUpdate("claim", item, values)
  fail("claim mode updates GitHub Project fields; rerun with --yes to continue")
}

updateProjectItemFields({ project, item, values })

console.log("agent-runner claim: updated GitHub Project fields")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`branch: ${item.dryRunPlan.branch}`)
console.log(`workspace: ${item.dryRunPlan.workspace}`)
console.log("agent state: Planning")
console.log("")
console.log("No agent was run. No branch was pushed.")

function printUpdate(action, selectedItem, fieldValues) {
  console.log(`agent-runner ${action} would update:`)
  console.log(`issue: #${selectedItem.issue.number} ${selectedItem.issue.title}`)
  console.log(`repository: ${repository}`)
  for (const [fieldName, value] of Object.entries(fieldValues)) {
    console.log(`${fieldName}: ${value}`)
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
