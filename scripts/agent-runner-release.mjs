import { updateProjectItemFields } from "./lib/agent-project-fields.mjs"
import {
  currentRepositoryFromOrigin,
  fail,
  findProjectIssueItem,
  loadEvaluatedProject,
  parseArgs,
  projectConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"
import {
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"

const releasableStates = new Set([
  "Planning",
  "Running",
  "Blocked",
  "Human Review",
  "Changes Requested",
  "CI Repair",
])

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:release",
  summary: "Return claimed work to the ready queue without shipping implementation work.",
  usage: 'pnpm agent:queue:release -- --issue <number> --reason "..." --yes',
  options: [
    ["--issue <number>", "Issue number to release."],
    ["--reason <text>", "Reason recorded in the Evidence field."],
    ["--evidence <text>", "Explicit Evidence field value. Defaults from --reason."],
    ["--force", "Allow release outside the normal claimed states."],
    ...repositoryOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("release mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const project = loadEvaluatedProject(projectConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})
const currentState = item.fields["Agent State"]

if (item.issue.state !== "OPEN") {
  fail(`issue #${args.issue} is not releasable because issue state is ${item.issue.state}`)
}

if (!args.force && !releasableStates.has(currentState)) {
  fail(
    `issue #${args.issue} is not in a releasable Agent State: ${
      currentState ?? "unset"
    }; pass --force to override`,
  )
}

const values = {
  Status: "Todo",
  "Agent State": "Ready",
  "Last Heartbeat": today(),
  Evidence: args.evidence ?? args.reason ?? `Released local claim at ${new Date().toISOString()}`,
}
const clear = ["Branch", "Workspace", "Blocked By"]

if (!args.yes) {
  printUpdate(item, values, clear)
  fail("release mode updates GitHub Project fields; rerun with --yes to continue")
}

updateProjectItemFields({ project, item, values, clear })

console.log("agent-runner release: updated GitHub Project fields")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log("agent state: Ready")
console.log("")
console.log("No agent was run. No branch was pushed.")

function printUpdate(selectedItem, fieldValues, clearFields) {
  console.log("agent-runner release would update:")
  console.log(`issue: #${selectedItem.issue.number} ${selectedItem.issue.title}`)
  console.log(`repository: ${repository}`)
  for (const [fieldName, value] of Object.entries(fieldValues)) {
    console.log(`${fieldName}: ${value}`)
  }
  for (const fieldName of clearFields) {
    console.log(`${fieldName}: <clear>`)
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
