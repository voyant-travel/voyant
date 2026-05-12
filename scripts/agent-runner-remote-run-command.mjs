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
  commandRunStates,
} from "./lib/agent-runner-execution.mjs"
import {
  eventLogOptions,
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import {
  remoteCommandRunArtifactPlan,
  remoteCommandRunBrowserEvidenceBlockReason,
  remoteCommandRunEnvironment,
  remoteCommandRunFieldUpdate,
  remoteLoggedCommandShell,
  remoteWriteFileShell,
} from "./lib/agent-runner-remote-execution.mjs"
import {
  loadRemoteWorkspaceAdapters,
  resolveRemoteWorkspaceAdapter,
} from "./lib/agent-runner-remote-workspace.mjs"
import {
  isRemoteWorkspaceDescriptor,
  parseWorkspaceReference,
} from "./lib/agent-runner-workspace-contract.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:remote-run-command",
  summary: "Run a supervised command inside an already bootstrapped remote workspace.",
  usage:
    'pnpm agent:queue:remote-run-command -- --issue <number> --command "pnpm verify:fast" --yes',
  options: [
    ["--issue <number>", "Issue number whose remote workspace should run the command."],
    ["--command <shell>", "Shell command to run from the remote repository directory."],
    [
      "--workspace <reference>",
      "Workspace reference override, for example sandbox:sprite:task-579.",
    ],
    ["--branch <name>", "Branch reference for evidence. Defaults from the Project field."],
    ["--remote-dir <path>", "Remote repository directory."],
    ["--evidence-path <path>", "Evidence path relative to the remote repository directory."],
    [
      "--ui-evidence <text>",
      "Browser artifacts or approved exception for successful UI-labeled work.",
    ],
    [
      "--allow-browser-issues",
      "Allow UI evidence with browser quality issues after maintainer review.",
    ],
    ["--force", "Allow command execution outside the normal run states."],
    [
      "--adapter-config <path>",
      "Optional remote adapter config module. Defaults to .agents/remote-workspaces.mjs when present.",
    ],
    ["--json", "Print machine-readable JSON."],
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("remote-run-command mode requires --issue <number>")
}

if (!args.command) {
  fail("remote-run-command mode requires --command <shell>")
}

if (!args.yes) {
  fail("remote-run-command requires --yes because it runs a remote command")
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
const descriptor = parseWorkspaceReference(workspaceReference, { repoRoot })
if (!isRemoteWorkspaceDescriptor(descriptor)) {
  fail(
    `remote-run-command requires a remote-sandbox workspace; got ${
      descriptor.kind === "invalid" ? descriptor.reason : descriptor.kind
    }`,
  )
}

const branch = args.branch ?? item.fields.Branch ?? item.dryRunPlan.branch
const artifactPlan = remoteCommandRunArtifactPlan({
  descriptor,
  evidencePath: args.evidencePath,
  item,
  remoteDir: args.remoteDir,
  workspaceReference,
})

if (!artifactPlan.safeEvidencePath) {
  fail(
    `remote-run-command refuses evidence outside the remote workspace: ${artifactPlan.evidenceFile}`,
  )
}

const adapters = await loadAdapters({ descriptor, workspaceReference })
const adapter = resolveAdapter(descriptor, { adapters })
if (!adapter.capabilities.exec) {
  failInspection(
    new Error(`remote workspace provider ${descriptor.provider} cannot exec commands`),
    {
      descriptor,
      workspaceReference,
    },
  )
}

const runningUpdate = {
  clear: ["Blocked By"],
  values: {
    "Agent State": "Running",
    "Last Heartbeat": today(),
    Evidence: artifactPlan.logPointer,
  },
}

updateProjectItemFields({
  clear: runningUpdate.clear,
  item,
  project,
  values: runningUpdate.values,
})

const startedAt = new Date()
const commandResult = await runRemoteExec({
  adapter,
  args: ["-lc", remoteLoggedCommandShell({ command: args.command, logFile: artifactPlan.logFile })],
  command: "bash",
  cwd: artifactPlan.workspace,
  env: remoteCommandRunEnvironment({ artifactPlan, branch, descriptor, item, repository }),
  httpPost: true,
})
const stoppedAt = new Date()
const exitCode = commandResult.status ?? 1
const browserBlockReason = remoteCommandRunBrowserEvidenceBlockReason({
  allowBrowserIssues: Boolean(args.allowBrowserIssues),
  exitCode,
  force: Boolean(args.force),
  item,
  repoRoot,
  uiEvidence: args.uiEvidence,
})
const evidencePacket = buildCommandEvidencePacket({
  artifactPlan: { ...artifactPlan, browserEvidenceWorkspace: repoRoot, repoRoot },
  blockedBy: browserBlockReason,
  branch,
  command: args.command,
  exitCode,
  item,
  repository,
  startedAt,
  stoppedAt,
  uiEvidence: args.uiEvidence,
})
const evidenceWriteResult = await runRemoteExec({
  adapter,
  args: [
    "-lc",
    remoteWriteFileShell({
      content: evidencePacket,
      file: artifactPlan.evidenceFile,
    }),
  ],
  command: "bash",
  cwd: artifactPlan.workspace,
  httpPost: true,
})
const finalUpdate = remoteCommandRunFieldUpdate({
  allowMissingBrowserEvidence: Boolean(args.force),
  artifactPlan,
  browserBlockReason,
  evidenceWriteStatus: evidenceWriteResult.status ?? 1,
  exitCode,
  item,
  uiEvidence: args.uiEvidence,
})

if (finalUpdate.blockedBy && evidenceWriteResult.status === 0) {
  await runRemoteExec({
    adapter,
    args: [
      "-lc",
      remoteWriteFileShell({
        content: buildCommandEvidencePacket({
          artifactPlan: { ...artifactPlan, browserEvidenceWorkspace: repoRoot, repoRoot },
          blockedBy: finalUpdate.blockedBy,
          branch,
          command: args.command,
          exitCode,
          item,
          repository,
          startedAt,
          stoppedAt,
          uiEvidence: args.uiEvidence,
        }),
        file: artifactPlan.evidenceFile,
      }),
    ],
    command: "bash",
    cwd: artifactPlan.workspace,
    httpPost: true,
  })
}

updateProjectItemFields({
  clear: finalUpdate.clear,
  item,
  project,
  values: finalUpdate.values,
})
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "remote-run-command.completed",
    blockedBy: finalUpdate.blockedBy ?? null,
    branch,
    clearedFields: finalUpdate.clear,
    command: args.command,
    evidence: artifactPlan.evidencePointer,
    evidenceWriteStatus: evidenceWriteResult.status ?? 1,
    exitCode,
    fields: finalUpdate.values,
    issue: issueEventDetails(item),
    log: artifactPlan.logPointer,
    repository,
    remoteDir: artifactPlan.workspace,
    workspace: workspaceReference,
  },
})

if (args.json) {
  console.log(
    JSON.stringify(
      {
        commandResult,
        evidenceWriteResult,
        finalUpdate,
        issue: item.issue,
        repository,
        workspaceReference,
      },
      null,
      2,
    ),
  )
} else {
  if (commandResult.stdout) console.log(commandResult.stdout)
  if (commandResult.stderr) console.error(commandResult.stderr)
  if (evidenceWriteResult.stderr) console.error(evidenceWriteResult.stderr)
  console.log("agent-runner remote-run-command: command finished and Project fields were updated")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`workspace: ${workspaceReference}`)
  console.log(`remote dir: ${artifactPlan.workspace}`)
  console.log(`log: ${artifactPlan.logFile}`)
  console.log(`evidence: ${artifactPlan.evidenceFile}`)
  console.log(`exit code: ${exitCode}`)
  console.log(`agent state: ${finalUpdate.values["Agent State"]}`)
}

process.exitCode = finalUpdate.blockedBy ? 1 : exitCode

async function loadAdapters({ descriptor, workspaceReference }) {
  try {
    return await loadRemoteWorkspaceAdapters({
      configPath: args.adapterConfig,
      repoRoot,
    })
  } catch (error) {
    failInspection(error, { descriptor, workspaceReference })
  }
}

function resolveAdapter(descriptor, { adapters }) {
  try {
    return resolveRemoteWorkspaceAdapter(descriptor, { adapters })
  } catch (error) {
    failInspection(error, { descriptor, workspaceReference })
  }
}

async function runRemoteExec({ adapter, ...command }) {
  try {
    return await adapter.exec(command)
  } catch (error) {
    return {
      status: 1,
      stderr: error instanceof Error ? error.message : String(error),
      stdout: "",
    }
  }
}

function failInspection(error, { descriptor, workspaceReference }) {
  const message = error instanceof Error ? error.message : String(error)
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          error: message,
          repository,
          workspace: {
            descriptor,
            reference: workspaceReference,
          },
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  fail(message)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
