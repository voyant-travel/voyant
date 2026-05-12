import { updateProjectItemFields } from "./lib/agent-project-fields.mjs"
import {
  currentRepositoryFromOrigin,
  fail,
  findProjectIssueItem,
  loadAllEvaluatedProject,
  parseArgs,
  projectScanConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"
import {
  issueEventDetails,
  resolveEventLogPath,
  tryAppendAgentRunnerEvent,
} from "./lib/agent-runner-events.mjs"
import {
  eventLogOptions,
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"

const heartbeatStates = new Set([
  "Planning",
  "Running",
  "Blocked",
  "Human Review",
  "Changes Requested",
  "CI Repair",
])

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:heartbeat",
  summary: "Refresh heartbeat metadata and optionally move an active agent item state.",
  usage: "pnpm agent:queue:heartbeat -- --issue <number> --state Running --yes",
  options: [
    ["--issue <number>", "Issue number to update."],
    ["--state <state>", "Next Agent State. Defaults to the current Project state."],
    ["--blocked-by <text>", "Required with Blocked unless --reason is provided."],
    ["--reason <text>", "Reason for a blocked heartbeat or evidence note."],
    ["--evidence <url-or-path>", "Evidence pointer to write to the Project item."],
    ["--force", "Allow updates outside the normal heartbeat states."],
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("heartbeat mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})
const currentState = item.fields["Agent State"]
const nextState = args.state ?? currentState

if (item.issue.state !== "OPEN") {
  fail(`issue #${args.issue} cannot heartbeat because issue state is ${item.issue.state}`)
}

if (!nextState || !heartbeatStates.has(nextState)) {
  fail(`Agent State must be one of: ${Array.from(heartbeatStates).join(", ")}`)
}

if (!args.force && !heartbeatStates.has(currentState)) {
  fail(
    `issue #${args.issue} is not in a heartbeat Agent State: ${
      currentState ?? "unset"
    }; pass --force to override`,
  )
}

if (nextState === "Blocked" && !(args.blockedBy ?? args.reason)) {
  fail("blocked heartbeats require --blocked-by or --reason")
}

if (nextState === "Human Review" && !args.evidence) {
  fail("human review heartbeats require --evidence <url-or-path>")
}

const values = {
  "Agent State": nextState,
  "Last Heartbeat": today(),
}

if (args.evidence) values.Evidence = args.evidence
if (args.blockedBy ?? args.reason) values["Blocked By"] = args.blockedBy ?? args.reason

const clear = nextState === "Blocked" ? [] : ["Blocked By"]

if (!args.yes) {
  printUpdate(item, values, clear)
  fail("heartbeat mode updates GitHub Project fields; rerun with --yes to continue")
}

updateProjectItemFields({ project, item, values, clear })
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "heartbeat.completed",
    clearedFields: clear,
    fields: values,
    issue: issueEventDetails(item),
    previousAgentState: currentState ?? null,
    repository,
  },
})

console.log("agent-runner heartbeat: updated GitHub Project fields")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`agent state: ${nextState}`)
console.log("")
console.log("No agent was run. No branch was pushed.")

function printUpdate(selectedItem, fieldValues, clearFields) {
  console.log("agent-runner heartbeat would update:")
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
