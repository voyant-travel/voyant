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
  command: "agent:queue:repair-ci",
  summary: "Run the configured local CI repair command for an item with a collected CI packet.",
  usage: "pnpm agent:queue:repair-ci -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose local workspace should run the repair command."],
    ...ciRepairCommandOptions,
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
  fail("repair-ci mode requires --issue <number>")
}

const command = ciRepairCommandFromArgs(args)
if (!command) {
  fail(`repair-ci mode requires --ci-repair-command or ${ciRepairCommandEnvVar}`)
}

if (!args.yes) {
  fail("repair-ci mode runs the configured CI repair command; rerun with --yes")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const commandArgs = forwardCiRepairCommand({
  args,
  command,
  issue: args.issue,
  repository,
})

console.log("agent-runner repair-ci: forwarding to supervised local command")
console.log(`command: pnpm ${commandArgs.join(" ")}`)
process.exitCode = runForwardedCiRepairCommand(commandArgs) ?? 1
