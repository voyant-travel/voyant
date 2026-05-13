import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  ciRepairCommandEnvVar,
  ciRepairCommandFromArgs,
  ciRepairCommandOptions,
  forwardCiRepairCommand,
  runForwardedCiRepairCommand,
} from "./lib/agent-runner-ci-repair-command.mjs"
import {
  eventLogOptions,
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:remote-repair-ci",
  summary: "Run the configured remote CI repair command for an item with a collected CI packet.",
  usage: "pnpm agent:queue:remote-repair-ci -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose remote workspace should run the repair command."],
    ...ciRepairCommandOptions,
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
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("remote-repair-ci mode requires --issue <number>")
}

const command = ciRepairCommandFromArgs(args)
if (!command) {
  fail(`remote-repair-ci mode requires --ci-repair-command or ${ciRepairCommandEnvVar}`)
}

if (!args.yes) {
  fail("remote-repair-ci mode runs the configured CI repair command; rerun with --yes")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const commandArgs = forwardCiRepairCommand({
  args,
  command,
  issue: args.issue,
  remote: true,
  repository,
})

if (args.remoteDir) {
  commandArgs.push("--remote-dir", args.remoteDir)
}

console.log("agent-runner remote-repair-ci: forwarding to supervised remote command")
console.log(`command: pnpm ${commandArgs.join(" ")}`)
process.exitCode = runForwardedCiRepairCommand(commandArgs) ?? 1
