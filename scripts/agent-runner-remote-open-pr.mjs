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
import {
  createPullRequest,
  evidenceForPullRequest,
  existingPullRequestUrl,
  isRemoteReference,
  openPullRequestStates,
  pullRequestBody,
  pullRequestFieldValues,
  pullRequestTitle,
} from "./lib/agent-runner-pr.mjs"
import { remotePullRequestPlan, remotePushBranchShell } from "./lib/agent-runner-remote-pr.mjs"
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
  command: "agent:queue:remote-open-pr",
  summary:
    "Push a remote workspace branch, open or reuse a draft PR, and update Project PR metadata.",
  usage: "pnpm agent:queue:remote-open-pr -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose remote branch should be published."],
    ["--base <ref>", "Base branch for the pull request. Defaults to main."],
    ["--branch <name>", "Branch override. Defaults from the Project Branch field."],
    [
      "--workspace <reference>",
      "Workspace reference override, for example sandbox:sprite:task-579.",
    ],
    ["--remote-dir <path>", "Remote repository directory."],
    ["--evidence <url>", "Evidence URL override. Defaults from the Project Evidence field."],
    ["--ready", "Open a ready-for-review PR instead of a draft PR."],
    ["--allow-dirty", "Allow opening a PR from a remote workspace with uncommitted changes."],
    ["--force", "Allow opening outside the normal handoff states."],
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
  fail("remote-open-pr mode requires --issue <number>")
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
  fail(`issue #${args.issue} cannot open a PR because issue state is ${item.issue.state}`)
}

if (!args.force && !openPullRequestStates.has(currentState)) {
  fail(
    `issue #${args.issue} is not in an open-pr Agent State: ${
      currentState ?? "unset"
    }; pass --force to override`,
  )
}

const workspaceReference = args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace
const descriptor = parseWorkspaceReference(workspaceReference, { repoRoot })
if (!isRemoteWorkspaceDescriptor(descriptor)) {
  fail(
    `remote-open-pr requires a remote-sandbox workspace; got ${
      descriptor.kind === "invalid" ? descriptor.reason : descriptor.kind
    }`,
  )
}

const plan = remotePullRequestPlan({
  branch: args.branch,
  descriptor,
  item,
  remoteDir: args.remoteDir,
})
const evidenceReference = args.evidence ?? item.fields.Evidence
if (!isRemoteReference(evidenceReference)) {
  fail("remote-open-pr mode requires a published remote Evidence URL")
}

const evidence = evidenceForPullRequest({
  evidenceReference,
  repoRoot,
  workspaceReference,
})
const title = pullRequestTitle(item)
const body = pullRequestBody(item, {
  ...evidence,
  repository,
})
const base = args.base ?? "main"
const existingPrUrl = item.fields.PR || existingPullRequestUrl({ branch: plan.branch, repository })
const values = pullRequestFieldValues({
  prUrl: existingPrUrl ?? "<new pull request URL>",
})

if (!args.yes) {
  printOpenPrPlan({
    base,
    existingPrUrl,
    item,
    plan,
    repository,
    title,
    values,
    workspaceReference,
  })
  fail("remote-open-pr pushes a branch, opens a PR, and updates Project fields; rerun with --yes")
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

const pushResult = await runRemoteExec({
  adapter,
  args: [
    "-lc",
    remotePushBranchShell({
      allowDirty: Boolean(args.allowDirty),
      branch: plan.branch,
    }),
  ],
  command: "bash",
  cwd: plan.workspace,
  httpPost: true,
})

if (pushResult.status !== 0) {
  failInspection(
    new Error(pushResult.stderr?.trim() || `remote branch push exited with ${pushResult.status}`),
    { descriptor, workspaceReference },
  )
}

const prUrl =
  existingPrUrl ??
  createPullRequest({
    base,
    body,
    branch: plan.branch,
    draft: !args.ready,
    repository,
    title,
  })

updateProjectItemFields({
  item,
  project,
  values: pullRequestFieldValues({ prUrl }),
})
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "remote-open-pr.completed",
    base,
    branch: plan.branch,
    draft: !args.ready,
    issue: issueEventDetails(item),
    pr: {
      url: prUrl,
    },
    pushStatus: pushResult.status,
    remoteDir: plan.workspace,
    repository,
    reused: Boolean(existingPrUrl),
    workspace: workspaceReference,
  },
})

if (args.json) {
  console.log(
    JSON.stringify(
      {
        issue: item.issue,
        pr: prUrl,
        pushResult,
        repository,
        workspace: {
          descriptor,
          reference: workspaceReference,
          remoteDir: plan.workspace,
        },
      },
      null,
      2,
    ),
  )
} else {
  if (pushResult.stdout) console.log(pushResult.stdout)
  if (pushResult.stderr) console.error(pushResult.stderr)
  console.log(
    "agent-runner remote-open-pr: pushed branch, opened or reused PR, and updated Project fields",
  )
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`branch: ${plan.branch}`)
  console.log(`workspace: ${workspaceReference}`)
  console.log(`remote dir: ${plan.workspace}`)
  console.log(`pr: ${prUrl}`)
}

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

function printOpenPrPlan({
  base,
  existingPrUrl,
  item,
  plan,
  repository,
  title,
  values,
  workspaceReference,
}) {
  console.log("agent-runner remote-open-pr would update:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`base: ${base}`)
  console.log(`branch: ${plan.branch}`)
  console.log(`workspace: ${workspaceReference}`)
  console.log(`remote dir: ${plan.workspace}`)
  console.log(`title: ${title}`)
  console.log(`PR: ${existingPrUrl ?? "<new draft pull request URL>"}`)
  for (const [fieldName, value] of Object.entries(values)) {
    console.log(`${fieldName}: ${value}`)
  }
}
