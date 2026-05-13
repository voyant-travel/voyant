import { spawnSync } from "node:child_process"

export const ciRepairCommandEnvVar = "AGENT_CI_REPAIR_COMMAND"

export const ciRepairCommandOptions = [
  [
    "--ci-repair-command <shell>",
    `Command used for automatic CI repair. Defaults from ${ciRepairCommandEnvVar}.`,
  ],
]

export function ciRepairCommandFromArgs(args, env = process.env) {
  const command = args.ciRepairCommand ?? env[ciRepairCommandEnvVar]
  if (typeof command !== "string") return undefined

  const normalized = command.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function ciRepairDispatchEnabled(args, env = process.env) {
  return Boolean(ciRepairCommandFromArgs(args, env))
}

export function forwardCiRepairCommand({ args, command, issue, remote = false, repository }) {
  const commandArgs = [
    remote ? "agent:queue:remote-run-command" : "agent:queue:run-command",
    "--",
    "--issue",
    String(issue),
    "--repo",
    repository,
    "--command",
    command,
    "--yes",
  ]

  appendOptional(commandArgs, args, "workspace", "--workspace")
  appendOptional(commandArgs, args, "branch", "--branch")
  appendOptional(commandArgs, args, "evidencePath", "--evidence-path")
  appendOptional(commandArgs, args, "uiEvidence", "--ui-evidence")
  appendOptional(commandArgs, args, "eventLog", "--event-log")
  appendOptional(commandArgs, args, "owner", "--owner")
  appendOptional(commandArgs, args, "project", "--project")
  appendOptional(commandArgs, args, "projectNumber", "--project-number")
  appendOptional(commandArgs, args, "limit", "--limit")
  appendOptional(commandArgs, args, "adapterConfig", "--adapter-config")

  if (args.allowBrowserIssues) commandArgs.push("--allow-browser-issues")
  if (args.force) commandArgs.push("--force")

  return commandArgs
}

export function runForwardedCiRepairCommand(commandArgs) {
  return spawnSync("pnpm", commandArgs, {
    encoding: "utf8",
    stdio: "inherit",
  }).status
}

function appendOptional(commandArgs, args, key, flag) {
  if (args[key] === undefined) return
  commandArgs.push(flag, String(args[key]))
}
