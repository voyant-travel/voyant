import { spawn } from "node:child_process"
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

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
  buildCommandEvidencePacket,
  canRunCommandState,
  commandRunArtifactPlan,
  commandRunBrowserEvidenceBlockReason,
  commandRunEnvironment,
  commandRunFieldUpdate,
  commandRunStates,
} from "./lib/agent-runner-execution.mjs"
import {
  eventLogOptions,
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:run-command",
  summary: "Run a provider-neutral command inside an already claimed task workspace.",
  usage: 'pnpm agent:queue:run-command -- --issue <number> --command "pnpm verify:fast" --yes',
  options: [
    ["--issue <number>", "Issue number whose workspace should run the command."],
    ["--command <shell>", "Shell command to run from the task workspace."],
    ["--workspace <path>", "Workspace path override."],
    ["--branch <name>", "Branch reference for evidence. Defaults from the Project field."],
    ["--evidence-path <path>", "Evidence path relative to the task workspace."],
    [
      "--ui-evidence <text>",
      "Required browser artifacts or approved exception for successful UI-labeled work.",
    ],
    [
      "--allow-browser-issues",
      "Allow UI evidence with browser quality issues after maintainer review.",
    ],
    ["--force", "Allow command execution outside the normal run states."],
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("run-command mode requires --issue <number>")
}

if (!args.command) {
  fail("run-command mode requires --command <shell>")
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

if (item.issue.state !== "OPEN") {
  fail(`issue #${args.issue} cannot run because issue state is ${item.issue.state}`)
}

if (!canRunCommandState(currentState, { force: Boolean(args.force) })) {
  fail(
    `issue #${args.issue} is not in a command-run Agent State: ${
      currentState ?? "unset"
    }; expected one of ${Array.from(commandRunStates).join(", ")} or pass --force`,
  )
}

const workspaceReference = args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace
const branch = args.branch ?? item.fields.Branch ?? item.dryRunPlan.branch
const artifactPlan = commandRunArtifactPlan({
  evidencePath: args.evidencePath,
  item,
  repoRoot,
  workspaceReference,
})

if (!artifactPlan.safeEvidencePath) {
  fail(`run-command refuses evidence outside the workspace: ${artifactPlan.evidenceFile}`)
}

if (!existsSync(artifactPlan.workspace)) {
  fail(`workspace does not exist: ${artifactPlan.workspace}`)
}

const runningUpdate = {
  values: {
    "Agent State": "Running",
    "Last Heartbeat": today(),
    Evidence: artifactPlan.logFile,
  },
  clear: ["Blocked By"],
}

if (!args.yes) {
  printRunPlan({ artifactPlan, branch, item, repository, runningUpdate })
  fail("run-command mode executes a local command and updates Project fields; rerun with --yes")
}

updateProjectItemFields({
  project,
  item,
  values: runningUpdate.values,
  clear: runningUpdate.clear,
})

const startedAt = new Date()
const exitCode = await runLoggedCommand({
  artifactPlan,
  branch,
  command: args.command,
  item,
  repository,
})
const stoppedAt = new Date()
const blockedBy = commandRunBrowserEvidenceBlockReason({
  allowBrowserIssues: Boolean(args.allowBrowserIssues),
  exitCode,
  force: Boolean(args.force),
  item,
  uiEvidence: args.uiEvidence,
  workspace: artifactPlan.workspace,
})
const finalUpdate = commandRunFieldUpdate({
  blockedBy,
  evidencePointer: artifactPlan.evidencePointer,
  exitCode,
})

mkdirSync(path.dirname(artifactPlan.evidenceFile), { recursive: true })
writeFileSync(
  artifactPlan.evidenceFile,
  buildCommandEvidencePacket({
    artifactPlan,
    branch,
    command: args.command,
    exitCode,
    item,
    repository,
    startedAt,
    stoppedAt,
    blockedBy,
    uiEvidence: args.uiEvidence,
  }),
  "utf8",
)

updateProjectItemFields({
  project,
  item,
  values: finalUpdate.values,
  clear: finalUpdate.clear,
})
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "run-command.completed",
    blockedBy: finalUpdate.blockedBy ?? null,
    branch,
    clearedFields: finalUpdate.clear,
    command: args.command,
    evidence: artifactPlan.evidencePointer,
    exitCode,
    fields: finalUpdate.values,
    issue: issueEventDetails(item),
    log: artifactPlan.logFile,
    repository,
    workspace: artifactPlan.workspace,
  },
})

console.log("agent-runner run-command: command finished and Project fields were updated")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`workspace: ${artifactPlan.workspace}`)
console.log(`log: ${artifactPlan.logFile}`)
console.log(`evidence: ${artifactPlan.evidenceFile}`)
console.log(`exit code: ${exitCode}`)
console.log(`agent state: ${finalUpdate.values["Agent State"]}`)

process.exitCode = blockedBy ? 1 : exitCode

function printRunPlan({ artifactPlan, branch, item, repository, runningUpdate }) {
  console.log("agent-runner run-command would execute:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`branch: ${branch}`)
  console.log(`workspace: ${artifactPlan.workspace}`)
  console.log(`command: ${args.command}`)
  console.log(`log: ${artifactPlan.logFile}`)
  console.log(`evidence: ${artifactPlan.evidenceFile}`)
  for (const [fieldName, value] of Object.entries(runningUpdate.values)) {
    console.log(`${fieldName}: ${value}`)
  }
  for (const fieldName of runningUpdate.clear) {
    console.log(`${fieldName}: <clear>`)
  }
}

async function runLoggedCommand({ artifactPlan, branch, command, item, repository }) {
  mkdirSync(path.dirname(artifactPlan.logFile), { recursive: true })
  const logStream = createWriteStream(artifactPlan.logFile, { flags: "a" })
  const env = {
    ...process.env,
    ...commandRunEnvironment({ artifactPlan, branch, item, repository }),
  }

  logStream.write(`# ${new Date().toISOString()} ${command}\n\n`)

  const child = spawn(command, {
    cwd: artifactPlan.workspace,
    env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  child.stdout.pipe(logStream, { end: false })
  child.stderr.pipe(logStream, { end: false })

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject)
    child.on("close", (code, signal) => {
      if (signal) {
        resolve(128)
        return
      }
      resolve(code ?? 1)
    })
  }).catch((error) => {
    logStream.write(`\ncommand failed to start: ${error.message}\n`)
    return 1
  })

  logStream.write(`\n# exit code: ${exitCode}\n`)
  await new Promise((resolve) => logStream.end(resolve))
  return exitCode
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
